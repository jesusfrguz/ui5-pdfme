REPORT zui5_pdfme_activate_v2.

" Run this optional report in the SAP Gateway hub (or embedded system).
" The backend IWSV/IWMO service must already exist. The report does not create
" a SEGW project, system alias, RFC destination, trust or authorization.

PARAMETERS:
  p_srv  TYPE /iwfnd/med_mdl_srg_name OBLIGATORY,
  p_vers TYPE /iwfnd/med_mdl_version OBLIGATORY DEFAULT '0001',
  p_pref TYPE /iwfnd/med_mdl_namespace,
  p_alias TYPE /iwfnd/defi_system_alias OBLIGATORY,
  p_pack TYPE devclass OBLIGATORY,
  p_trkor TYPE trkorr OBLIGATORY,
  p_defcl AS CHECKBOX DEFAULT abap_false,
  p_apply AS CHECKBOX DEFAULT abap_false.

START-OF-SELECTION.
  DATA:
    lo_api TYPE REF TO /iwfnd/cl_mgw_activation_api,
    lv_identifier TYPE /iwfnd/med_mdl_srg_identifier,
    lv_active TYPE abap_bool.

  WRITE: / 'Service:', p_srv, 'Version:', p_vers, 'Prefix:', p_pref.
  WRITE: / 'Alias:', p_alias, 'Hub package:', p_pack, 'Hub request:', p_trkor.
  WRITE: / 'Register in default client:', p_defcl.

  TRY.
      lo_api = /iwfnd/cl_mgw_activation_api=>get_instance( ).
      lo_api->is_active(
        EXPORTING
          iv_service_name = p_srv
          iv_service_version = p_vers
          iv_prefix = p_pref
        IMPORTING
          ev_active = lv_active ).

      IF lv_active = abap_true.
        WRITE: / 'This service name/version/prefix is already active. Nothing changed.'.
        WRITE: / 'The requested alias was not verified; check /IWFND/MAINT_SERVICE.'.
        RETURN.
      ENDIF.

      IF p_apply = abap_false.
        WRITE: / 'DRY RUN: the service is not active; select APPLY to activate it.'.
        RETURN.
      ENDIF.

      lo_api->activate_service(
        EXPORTING
          iv_service_name = p_srv
          iv_service_version = p_vers
          iv_prefix = p_pref
          iv_system_alias = p_alias
          iv_package = p_pack
          iv_transport = p_trkor
          iv_default_client = p_defcl
          iv_suppress_dialog = abap_true
        IMPORTING
          ev_srg_identifier = lv_identifier ).

      WRITE: / 'Activated service identifier:', lv_identifier.
      WRITE: / 'Verify the ICF node, system alias, authorizations and $metadata.'.
    CATCH /iwfnd/cx_med_remote INTO DATA(lx_remote).
      WRITE: / 'ACTIVATION FAILED:', lx_remote->get_text( ).
      WRITE: / 'No service was deleted and no transport was released.'.
  ENDTRY.
