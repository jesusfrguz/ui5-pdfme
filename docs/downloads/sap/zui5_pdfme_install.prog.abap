REPORT zui5_pdfme_install.

" Optional, conservative installer for the ui5-pdfme repository contract.
" Target: SAP S/4HANA 2022+ with the XCO Generation APIs used below.
" Import this report into a temporary Z program, run the dry run first and
" syntax-check it against the exact XCO API state of the target release/SP.
" It never deletes, overwrites or releases repository objects.
" Existing objects are skipped without checking that their definitions match.
" Generation uses multiple PUT operations and is not atomic.

PARAMETERS:
  p_pack TYPE devclass OBLIGATORY,
  p_trkor TYPE trkorr OBLIGATORY.

SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME.
PARAMETERS:
  p_rap  RADIOBUTTON GROUP impl DEFAULT 'X',
  p_cds  RADIOBUTTON GROUP impl,
  p_segw RADIOBUTTON GROUP impl.
SELECTION-SCREEN END OF BLOCK b1.

PARAMETERS:
  p_apply AS CHECKBOX DEFAULT abap_false,
  p_pub   AS CHECKBOX DEFAULT abap_false.

CLASS lcl_installer DEFINITION FINAL.
  PUBLIC SECTION.
    METHODS run.

  PRIVATE SECTION.
    CONSTANTS:
      c_dtel_id     TYPE sxco_ad_object_name VALUE 'ZPDFME_ID',
      c_dtel_name   TYPE sxco_ad_object_name VALUE 'ZPDFME_NAME',
      c_dtel_desc   TYPE sxco_ad_object_name VALUE 'ZPDFME_DESC',
      c_dtel_tags   TYPE sxco_ad_object_name VALUE 'ZPDFME_TAGS',
      c_dtel_status TYPE sxco_ad_object_name VALUE 'ZPDFME_STATUS',
      c_dtel_json   TYPE sxco_ad_object_name VALUE 'ZPDFME_JSON',
      c_table       TYPE sxco_dbt_object_name VALUE 'ZPDFME_TPL',
      c_ddls_i      TYPE sxco_cds_object_name VALUE 'ZPDFME_I_TPL',
      c_ddls_c      TYPE sxco_cds_object_name VALUE 'ZPDFME_C_TPL',
      c_ddls_v2     TYPE sxco_cds_object_name VALUE 'ZPDFME_CDS_TPL',
      c_bdef_i      TYPE sxco_cds_object_name VALUE 'ZPDFME_I_TPL',
      c_bdef_c      TYPE sxco_cds_object_name VALUE 'ZPDFME_C_TPL',
      c_bpool       TYPE sxco_ao_object_name  VALUE 'ZBP_PDFME_I_TPL',
      c_srvd        TYPE sxco_srvd_object_name VALUE 'ZPDFME_TPL_SRVD',
      c_srvb        TYPE sxco_srvb_object_name VALUE 'ZPDFME_TPL_O4'.

    METHODS check_inputs.
    METHODS show_plan.
    METHODS create_dictionary.
    METHODS create_rap.
    METHODS create_classic_cds.
    METHODS publish_rap.
    METHODS add_data_element
      IMPORTING
        io_put         TYPE REF TO if_xco_cp_gen_d_o_put
        iv_name        TYPE sxco_ad_object_name
        iv_description TYPE string
        io_type        TYPE REF TO if_xco_gen_dtel_data_type.
    METHODS add_ddls_source
      IMPORTING
        io_put         TYPE REF TO if_xco_cp_gen_d_o_put
        iv_name        TYPE sxco_cds_object_name
        iv_description TYPE string
        iv_source      TYPE string.
    METHODS object_state
      IMPORTING iv_kind TYPE string iv_name TYPE string
      RETURNING VALUE(rv_state) TYPE string.
ENDCLASS.

CLASS lcl_installer IMPLEMENTATION.
  METHOD run.
    check_inputs( ).
    show_plan( ).

    IF p_apply = abap_false.
      WRITE: / 'DRY RUN: no repository object was changed.'.
      WRITE: / 'Select APPLY only after reviewing the package, transport and plan.'.
      RETURN.
    ENDIF.

    TRY.
        create_dictionary( ).

        IF p_rap = abap_true.
          create_rap( ).
          IF p_pub = abap_true.
            publish_rap( ).
          ENDIF.
        ELSEIF p_cds = abap_true.
          create_classic_cds( ).
          WRITE: / 'Register ZPDFME_CDS_TPL_CDS in /IWFND/MAINT_SERVICE.'.
          WRITE: / 'This legacy CDS route exposes catalog headers only; JSON payloads are not exposed.'.
        ELSE.
          WRITE: / 'Missing DDIC objects created; existing objects skipped without compatibility checks.'.
          WRITE: / 'Import template-repository-v2.edmx in SEGW and generate MPC/DPC.'.
          WRITE: / 'SEGW project generation is intentionally not automated: no universal released API exists.'.
          WRITE: / 'SEGW requires a DPC_EXT implementation for authorization, validation, versioning and audit ownership.'.
        ENDIF.
      CATCH cx_root INTO DATA(lx_error).
        WRITE: / 'INSTALLATION FAILED:', lx_error->get_text( ).
        WRITE: / 'No existing object was deleted or overwritten by this report.'.
    ENDTRY.
  ENDMETHOD.

  METHOD check_inputs.
    TRANSLATE p_pack TO UPPER CASE.
    TRANSLATE p_trkor TO UPPER CASE.

    IF p_pack = '$TMP'.
      MESSAGE 'Use a transportable package; XCO generation requires a modifiable Workbench request' TYPE 'E'.
    ENDIF.

    IF xco_cp_abap_repository=>package->for( p_pack )->exists( ) = abap_false.
      MESSAGE |Package { p_pack } does not exist| TYPE 'E'.
    ENDIF.

    " Constructing the environment is deliberately done for the supplied request.
    " XCO validates its type/status/transport target when a PUT is executed.
    DATA(lo_environment) = xco_cp_generation=>environment->dev_system( p_trkor ).
    IF lo_environment IS NOT BOUND.
      MESSAGE |Transport { p_trkor } is not available| TYPE 'E'.
    ENDIF.

    IF p_pub = abap_true AND p_rap = abap_false.
      WRITE: / 'PUBLISH is only automatic for the local RAP V4 service binding.'.
      WRITE: / 'Classic CDS/SEGW activation needs a pre-existing system alias and hub-specific settings.'.
    ENDIF.
  ENDMETHOD.

  METHOD show_plan.
    DATA(lv_mode) = COND string(
      WHEN p_rap = abap_true THEN 'RAP / OData V4'
      WHEN p_cds = abap_true THEN 'classic CDS catalog / OData V2'
      ELSE 'SAP Gateway SEGW / OData V2' ).

    WRITE: / 'ui5-pdfme SAP installer'.
    WRITE: / 'Mode:', lv_mode.
    WRITE: / 'Package:', p_pack, 'Workbench request:', p_trkor.
    WRITE: / 'Apply:', p_apply, 'Publish local RAP endpoint:', p_pub.
    ULINE.

    WRITE: / object_state( iv_kind = 'DTEL' iv_name = c_dtel_id ).
    WRITE: / object_state( iv_kind = 'DTEL' iv_name = c_dtel_name ).
    WRITE: / object_state( iv_kind = 'DTEL' iv_name = c_dtel_desc ).
    WRITE: / object_state( iv_kind = 'DTEL' iv_name = c_dtel_tags ).
    WRITE: / object_state( iv_kind = 'DTEL' iv_name = c_dtel_status ).
    WRITE: / object_state( iv_kind = 'DTEL' iv_name = c_dtel_json ).
    WRITE: / object_state( iv_kind = 'TABL' iv_name = c_table ).

    IF p_rap = abap_true.
      WRITE: / object_state( iv_kind = 'DDLS' iv_name = c_ddls_i ).
      WRITE: / object_state( iv_kind = 'DDLS' iv_name = c_ddls_c ).
      WRITE: / object_state( iv_kind = 'BDEF' iv_name = c_bdef_i ).
      WRITE: / object_state( iv_kind = 'BDEF' iv_name = c_bdef_c ).
      WRITE: / object_state( iv_kind = 'CLAS' iv_name = c_bpool ).
      WRITE: / object_state( iv_kind = 'SRVD' iv_name = c_srvd ).
      WRITE: / object_state( iv_kind = 'SRVB' iv_name = c_srvb ).
    ELSEIF p_cds = abap_true.
      WRITE: / object_state( iv_kind = 'DDLS' iv_name = c_ddls_v2 ).
    ELSE.
      WRITE: / 'MANUAL: create/reuse SEGW project, import EDMX, generate and implement DPC_EXT.'.
    ENDIF.
  ENDMETHOD.

  METHOD object_state.
    DATA(lv_exists) = abap_false.

    CASE iv_kind.
      WHEN 'DTEL'.
        lv_exists = xco_cp_abap_dictionary=>data_element( CONV sxco_ad_object_name( iv_name ) )->exists( ).
      WHEN 'TABL'.
        lv_exists = xco_cp_abap_dictionary=>database_table( CONV sxco_dbt_object_name( iv_name ) )->exists( ).
      WHEN 'DDLS'.
        lv_exists = xco_cp_abap_repository=>object->ddls->for( CONV sxco_cds_object_name( iv_name ) )->exists( ).
      WHEN 'BDEF'.
        lv_exists = xco_cp_abap_repository=>object->bdef->for( CONV sxco_cds_object_name( iv_name ) )->exists( ).
      WHEN 'CLAS'.
        lv_exists = xco_cp_abap_repository=>object->clas->for( CONV sxco_ao_object_name( iv_name ) )->exists( ).
      WHEN 'SRVD'.
        lv_exists = xco_cp_abap_repository=>object->srvd->for( CONV sxco_srvd_object_name( iv_name ) )->exists( ).
      WHEN 'SRVB'.
        lv_exists = xco_cp_abap_repository=>object->srvb->for( CONV sxco_srvb_object_name( iv_name ) )->exists( ).
    ENDCASE.

    rv_state = |{ iv_kind } { iv_name }: { COND string( WHEN lv_exists = abap_true THEN 'EXISTS - skip without compatibility check' ELSE 'MISSING - create' ) }|.
  ENDMETHOD.

  METHOD add_data_element.
    IF xco_cp_abap_dictionary=>data_element( iv_name )->exists( ) = abap_true.
      RETURN.
    ENDIF.

    DATA(lo_specification) = io_put->for-dtel->add_object( iv_name
      )->set_package( p_pack
      )->create_form_specification( ).
    lo_specification->set_short_description( iv_description ).
    lo_specification->set_data_type( io_type ).
  ENDMETHOD.

  METHOD create_dictionary.
    DATA(lo_environment) = xco_cp_generation=>environment->dev_system( p_trkor ).
    DATA(lo_put) = lo_environment->create_put_operation( ).

    add_data_element(
      io_put = lo_put iv_name = c_dtel_id iv_description = 'ui5-pdfme template ID'
      io_type = xco_cp_abap_dictionary=>built_in_type->char( 128 ) ).
    add_data_element(
      io_put = lo_put iv_name = c_dtel_name iv_description = 'ui5-pdfme template name'
      io_type = xco_cp_abap_dictionary=>built_in_type->char( 160 ) ).
    add_data_element(
      io_put = lo_put iv_name = c_dtel_desc iv_description = 'ui5-pdfme description'
      io_type = xco_cp_abap_dictionary=>built_in_type->char( 1024 ) ).
    add_data_element(
      io_put = lo_put iv_name = c_dtel_tags iv_description = 'ui5-pdfme tags JSON'
      io_type = xco_cp_abap_dictionary=>built_in_type->string( 0 ) ).
    add_data_element(
      io_put = lo_put iv_name = c_dtel_status iv_description = 'ui5-pdfme status'
      io_type = xco_cp_abap_dictionary=>built_in_type->char( 20 ) ).
    add_data_element(
      io_put = lo_put iv_name = c_dtel_json iv_description = 'ui5-pdfme JSON payload'
      io_type = xco_cp_abap_dictionary=>built_in_type->string( 0 ) ).

    IF xco_cp_abap_dictionary=>database_table( c_table )->exists( ) = abap_false.
      DATA(lo_table) = lo_put->for-tabl-for-database_table->add_object( c_table
        )->set_package( p_pack
        )->create_form_specification( ).
      lo_table->set_short_description( 'ui5-pdfme template repository'
        )->set_delivery_class( xco_cp_database_table=>delivery_class->a
        )->set_data_maintenance( xco_cp_database_table=>data_maintenance->allowed ).

      lo_table->add_field( 'CLIENT' )->set_type( xco_cp_abap_dictionary=>built_in_type->clnt
        )->set_key_indicator( )->set_not_null( ).
      lo_table->add_field( 'ID' )->set_type( xco_cp_abap_dictionary=>data_element( c_dtel_id )
        )->set_key_indicator( )->set_not_null( ).
      lo_table->add_field( 'NAME' )->set_type( xco_cp_abap_dictionary=>data_element( c_dtel_name )
        )->set_not_null( ).
      lo_table->add_field( 'DESCRIPTION' )->set_type( xco_cp_abap_dictionary=>data_element( c_dtel_desc )
        )->set_not_null( ).
      lo_table->add_field( 'TAGS_JSON' )->set_type( xco_cp_abap_dictionary=>data_element( c_dtel_tags )
        )->set_not_null( ).
      lo_table->add_field( 'STATUS' )->set_type( xco_cp_abap_dictionary=>data_element( c_dtel_status )
        )->set_not_null( ).
      lo_table->add_field( 'VERSION' )->set_type( xco_cp_abap_dictionary=>built_in_type->int4
        )->set_not_null( ).
      lo_table->add_field( 'TEMPLATE_JSON' )->set_type( xco_cp_abap_dictionary=>data_element( c_dtel_json )
        )->set_not_null( ).
      lo_table->add_field( 'MAPPING_JSON' )->set_type( xco_cp_abap_dictionary=>data_element( c_dtel_json ) ).
      lo_table->add_field( 'METADATA_JSON' )->set_type( xco_cp_abap_dictionary=>data_element( c_dtel_json )
        )->set_not_null( ).
      lo_table->add_field( 'DATASOURCES_JSON' )->set_type( xco_cp_abap_dictionary=>data_element( c_dtel_json ) ).
      lo_table->add_field( 'CREATED_BY' )->set_type( xco_cp_abap_dictionary=>data_element( 'ABP_CREATION_USER' ) ).
      lo_table->add_field( 'CREATED_AT' )->set_type( xco_cp_abap_dictionary=>data_element( 'ABP_CREATION_TSTMPL' ) ).
      lo_table->add_field( 'LAST_CHANGED_BY' )->set_type( xco_cp_abap_dictionary=>data_element( 'ABP_LOCINST_LASTCHANGE_USER' ) ).
      lo_table->add_field( 'UPDATED_AT' )->set_type( xco_cp_abap_dictionary=>data_element( 'ABP_LOCINST_LASTCHANGE_TSTMPL' ) ).
    ENDIF.

    lo_put->execute( ).
    WRITE: / 'Missing DDIC objects created; existing objects skipped without compatibility checks.'.
  ENDMETHOD.

  METHOD add_ddls_source.
    IF xco_cp_abap_repository=>object->ddls->for( iv_name )->exists( ) = abap_true.
      RETURN.
    ENDIF.

    DATA(lo_template) = xco_cp_generation_ddls=>template->source( ).
    lo_template->set_short_description( iv_description )->set_source( iv_source ).
    io_put->for-ddls->add_object( iv_name )->set_package( p_pack )->set_template( lo_template ).
  ENDMETHOD.

  METHOD create_rap.
    DATA(lo_environment) = xco_cp_generation=>environment->dev_system( p_trkor ).
    DATA(lo_put) = lo_environment->create_put_operation( ).
    DATA(lv_nl) = cl_abap_char_utilities=>cr_lf.

    DATA(lv_interface_source) =
      |@AccessControl.authorizationCheck: #CHECK{ lv_nl }| &&
      |@EndUserText.label: 'ui5-pdfme template'{ lv_nl }| &&
      |define root view entity ZPDFME_I_TPL as select from zpdfme_tpl{ lv_nl }| &&
      |\{{ lv_nl }| &&
      |  key id as ID,{ lv_nl }| &&
      |      name as Name,{ lv_nl }| &&
      |      description as Description,{ lv_nl }| &&
      |      tags_json as Tags,{ lv_nl }| &&
      |      status as Status,{ lv_nl }| &&
      |      version as Version,{ lv_nl }| &&
      |      template_json as TemplateJson,{ lv_nl }| &&
      |      mapping_json as MappingJson,{ lv_nl }| &&
      |      metadata_json as MetadataJson,{ lv_nl }| &&
      |      datasources_json as DataSourcesJson,{ lv_nl }| &&
      |      @Semantics.user.createdBy: true created_by as CreatedBy,{ lv_nl }| &&
      |      @Semantics.systemDateTime.createdAt: true created_at as CreatedAt,{ lv_nl }| &&
      |      @Semantics.user.localInstanceLastChangedBy: true last_changed_by as LastChangedBy,{ lv_nl }| &&
      |      @Semantics.systemDateTime.localInstanceLastChangedAt: true updated_at as UpdatedAt{ lv_nl }| &&
      |\}|.

    DATA(lv_projection_source) =
      |@AccessControl.authorizationCheck: #CHECK{ lv_nl }| &&
      |@EndUserText.label: 'ui5-pdfme template API'{ lv_nl }| &&
      |@Metadata.allowExtensions: true{ lv_nl }| &&
      |define root view entity ZPDFME_C_TPL{ lv_nl }| &&
      |  provider contract transactional_query{ lv_nl }| &&
      |  as projection on ZPDFME_I_TPL{ lv_nl }| &&
      |\{ key ID, Name, Description, Tags, Status, Version,{ lv_nl }| &&
      |  TemplateJson, MappingJson, MetadataJson, DataSourcesJson,{ lv_nl }| &&
      |  CreatedBy, CreatedAt, LastChangedBy, UpdatedAt \}|.

    add_ddls_source( io_put = lo_put iv_name = c_ddls_i
      iv_description = 'ui5-pdfme template interface' iv_source = lv_interface_source ).
    add_ddls_source( io_put = lo_put iv_name = c_ddls_c
      iv_description = 'ui5-pdfme template projection' iv_source = lv_projection_source ).

    IF xco_cp_abap_repository=>object->bdef->for( c_bdef_i )->exists( ) = abap_false.
      DATA(lo_bdef_i) = lo_put->for-bdef->add_object( c_bdef_i
        )->set_package( p_pack )->create_form_specification( ).
      lo_bdef_i->set_short_description( 'ui5-pdfme managed behavior'
        )->set_implementation_type( xco_cp_behavior_definition=>implementation_type->managed
        )->set_implementation_class( c_bpool ).
      DATA(lo_behavior_i) = lo_bdef_i->add_behavior( ).
      lo_behavior_i->characteristics->set_persistent_table( c_table )->lock->set_master( ).
      lo_behavior_i->add_mapping_for( c_table )->set_field_mapping( VALUE #(
        ( cds_view_field = 'ID' dbtable_field = 'ID' )
        ( cds_view_field = 'Name' dbtable_field = 'NAME' )
        ( cds_view_field = 'Description' dbtable_field = 'DESCRIPTION' )
        ( cds_view_field = 'Tags' dbtable_field = 'TAGS_JSON' )
        ( cds_view_field = 'Status' dbtable_field = 'STATUS' )
        ( cds_view_field = 'Version' dbtable_field = 'VERSION' )
        ( cds_view_field = 'TemplateJson' dbtable_field = 'TEMPLATE_JSON' )
        ( cds_view_field = 'MappingJson' dbtable_field = 'MAPPING_JSON' )
        ( cds_view_field = 'MetadataJson' dbtable_field = 'METADATA_JSON' )
        ( cds_view_field = 'DataSourcesJson' dbtable_field = 'DATASOURCES_JSON' )
        ( cds_view_field = 'CreatedBy' dbtable_field = 'CREATED_BY' )
        ( cds_view_field = 'CreatedAt' dbtable_field = 'CREATED_AT' )
        ( cds_view_field = 'LastChangedBy' dbtable_field = 'LAST_CHANGED_BY' )
        ( cds_view_field = 'UpdatedAt' dbtable_field = 'UPDATED_AT' ) ) ).
      lo_behavior_i->add_standard_operation( xco_cp_behavior_definition=>standard_operation->create ).
      lo_behavior_i->add_standard_operation( xco_cp_behavior_definition=>standard_operation->update ).
      lo_behavior_i->add_standard_operation( xco_cp_behavior_definition=>standard_operation->delete ).
    ENDIF.

    IF xco_cp_abap_repository=>object->bdef->for( c_bdef_c )->exists( ) = abap_false.
      DATA(lo_bdef_c) = lo_put->for-bdef->add_object( c_bdef_c
        )->set_package( p_pack )->create_form_specification( ).
      lo_bdef_c->set_short_description( 'ui5-pdfme behavior projection'
        )->set_implementation_type( xco_cp_behavior_definition=>implementation_type->projection ).
      DATA(lo_behavior_c) = lo_bdef_c->add_behavior( ).
      lo_behavior_c->add_standard_operation( xco_cp_behavior_definition=>standard_operation->create )->set_use( ).
      lo_behavior_c->add_standard_operation( xco_cp_behavior_definition=>standard_operation->update )->set_use( ).
      lo_behavior_c->add_standard_operation( xco_cp_behavior_definition=>standard_operation->delete )->set_use( ).
    ENDIF.

    IF xco_cp_abap_repository=>object->clas->for( c_bpool )->exists( ) = abap_false.
      DATA(lo_class) = lo_put->for-clas->add_object( c_bpool
        )->set_package( p_pack )->create_form_specification( ).
      lo_class->set_short_description( 'ui5-pdfme behavior pool' ).
      lo_class->definition->set_abstract( )->set_for_behavior_of( c_ddls_i ).
    ENDIF.

    IF xco_cp_abap_repository=>object->srvd->for( c_srvd )->exists( ) = abap_false.
      DATA(lo_srvd) = lo_put->for-srvd->add_object( c_srvd
        )->set_package( p_pack )->create_form_specification( ).
      lo_srvd->set_short_description( 'ui5-pdfme template service' ).
      lo_srvd->add_exposure( c_ddls_c )->set_alias( 'Templates' ).
    ENDIF.

    lo_put->execute( ).

    IF xco_cp_abap_repository=>object->srvb->for( c_srvb )->exists( ) = abap_false.
      DATA(lo_srvb_put) = lo_environment->for-srvb->create_put_operation( ).
      DATA(lo_srvb) = lo_srvb_put->add_object( c_srvb
        )->set_package( p_pack )->create_form_specification( ).
      lo_srvb->set_short_description( 'ui5-pdfme OData V4 binding' ).
      lo_srvb->set_binding_type( xco_cp_service_binding=>binding_type->odata_v4_ui ).
      lo_srvb->add_service( )->add_version( '0001' )->set_service_definition( c_srvd ).
      lo_srvb_put->execute( ).
    ENDIF.

    WRITE: / 'Missing RAP objects created; existing objects skipped without compatibility checks.'.
    WRITE: / 'This RAP output is an installation skeleton, not production-ready.'.
    WRITE: / 'Before use: add DCL/authorization, validations, versioning/ETag and read-only audit handling.'.
    WRITE: / 'Generation uses multiple PUT operations and is not atomic.'.
  ENDMETHOD.

  METHOD create_classic_cds.
    DATA(lo_environment) = xco_cp_generation=>environment->dev_system( p_trkor ).
    DATA(lo_put) = lo_environment->create_put_operation( ).
    DATA(lv_nl) = cl_abap_char_utilities=>cr_lf.
    DATA(lv_source) =
      |@AbapCatalog.sqlViewName: 'ZPDFMETPLIDX'{ lv_nl }| &&
      |@AccessControl.authorizationCheck: #CHECK{ lv_nl }| &&
      |@EndUserText.label: 'ui5-pdfme catalog headers'{ lv_nl }| &&
      |@ObjectModel.readOnly: true{ lv_nl }| &&
      |@OData.publish: true{ lv_nl }| &&
      |define view ZPDFME_CDS_TPL as select from zpdfme_tpl{ lv_nl }| &&
      |\{ key id as ID, name as Name, description as Description,{ lv_nl }| &&
      |   status as Status, version as Version,{ lv_nl }| &&
      |   created_at as CreatedAt, updated_at as UpdatedAt \}|.

    add_ddls_source( io_put = lo_put iv_name = c_ddls_v2
      iv_description = 'ui5-pdfme legacy catalog V2' iv_source = lv_source ).
    lo_put->execute( ).
  ENDMETHOD.

  METHOD publish_rap.
    DATA(lo_binding) = xco_cp_abap_repository=>object->srvb->for( c_srvb ).
    IF xco_cp_service_binding=>local_service_endpoint->odata_v4->is_published( lo_binding ) = abap_false.
      DATA(lo_publish) = xco_cp_service_binding=>local_service_endpoint->odata_v4->operation->publish( lo_binding ).
      lo_publish->execute( ).
      WRITE: / 'Local RAP OData V4 endpoint published.'.
    ELSE.
      WRITE: / 'Local RAP OData V4 endpoint was already published.'.
    ENDIF.
  ENDMETHOD.
ENDCLASS.

START-OF-SELECTION.
  NEW lcl_installer( )->run( ).
