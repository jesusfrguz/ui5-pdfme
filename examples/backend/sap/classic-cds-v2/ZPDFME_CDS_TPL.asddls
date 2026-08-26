@AbapCatalog.sqlViewName: 'ZPDFMETPLIDX'
@AccessControl.authorizationCheck: #CHECK
@EndUserText.label: 'ui5-pdfme catalog headers'
@ObjectModel.readOnly: true
@OData.publish: true
define view ZPDFME_CDS_TPL as select from zpdfme_tpl
{
  key id          as ID,
      name        as Name,
      description as Description,
      status      as Status,
      version     as Version,
      created_at  as CreatedAt,
      updated_at  as UpdatedAt
}
