const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const sectionIds = (html) => [...html.matchAll(/<section id="([^"]+)"/g)].map((match) => match[1]);

test("SAP backend chooser is bilingual and offers every supported route", () => {
  const spanish = read("docs/sap/index.html");
  const englishCatalog = JSON.parse(read("docs/i18n/en/sap.json"));
  const english = `${spanish}\n${Object.values(englishCatalog.translations).join("\n")}`;
  const expectedSections = [
    "choose", "contract", "rap", "cap", "segw", "classic-cds", "rest",
    "installer", "packages", "client", "downloads", "validate"
  ];

  assert.deepEqual(sectionIds(spanish), expectedSections);
  assert.deepEqual(sectionIds(english), expectedSections);
  assert.match(spanish, /<html lang="es" data-i18n-page="sap">/);
  assert.equal(englishCatalog.locale, "en");

  for (const html of [spanish, english]) {
    for (const term of ["RAP", "CAP", "SEGW", "CDS", "REST", "OData V4", "OData V2"]) {
      assert.ok(html.includes(term), `missing SAP route: ${term}`);
    }
    for (const contract of ["Edm.String(128)", "Edm.String(160)", "Edm.String(1024)", "Edm.String(4096)", "Edm.Int32"]) {
      assert.ok(html.includes(contract), `missing SAP contract marker: ${contract}`);
    }
    assert.match(html, /5[.,]000[.,]000/);
    assert.match(html, /zui5_pdfme_install\.prog\.abap/);
    assert.match(html, /template-repository-v2\.edmx/);
    assert.match(html, /zui5_pdfme_activate_v2\.prog\.abap/);
  }
});

test("optional XCO installer is dry-run first, non-overwriting, and transport-aware", () => {
  const source = read("docs/downloads/sap/zui5_pdfme_install.prog.abap");

  assert.match(source, /p_pack TYPE devclass OBLIGATORY/);
  assert.match(source, /p_trkor TYPE trkorr OBLIGATORY/);
  assert.match(source, /p_apply AS CHECKBOX DEFAULT abap_false/);
  assert.match(source, /p_pub\s+AS CHECKBOX DEFAULT abap_false/);
  assert.match(source, /p_rap\s+RADIOBUTTON/);
  assert.match(source, /p_cds\s+RADIOBUTTON/);
  assert.match(source, /p_segw\s+RADIOBUTTON/);
  assert.match(source, /xco_cp_generation=>environment->dev_system\( p_trkor \)/);
  assert.match(source, /xco_cp_abap_repository=>package->for\( p_pack \)->exists/);
  assert.match(source, /odata_v4_ui/);
  assert.match(source, /@OData\.publish: true/);
  assert.match(source, /is_published/);
  assert.doesNotMatch(source, /create_delete_operation/);
  assert.doesNotMatch(source, /operation->unpublish/);
  assert.doesNotMatch(source, /release\s*\(/i);
  assert.doesNotMatch(source, /created\/verified/i);
  assert.match(source, /existing objects skipped without compatibility checks/i);
  assert.match(source, /installation skeleton, not production-ready/i);
  assert.match(source, /multiple PUT operations and is not atomic/i);
  assert.match(source, /DCL\/authorization, validations, versioning\/ETag and read-only audit/i);
  assert.match(source, /SEGW requires a DPC_EXT implementation/i);

  for (const marker of ["char( 128 )", "char( 160 )", "char( 1024 )", "int4", "string( 0 )"]) {
    assert.ok(source.includes(marker), `missing XCO type: ${marker}`);
  }
  assert.match(source, /iv_name = c_dtel_tags[\s\S]*?built_in_type->string\( 0 \)/);
  assert.doesNotMatch(source, /iv_name = c_dtel_tags[\s\S]*?built_in_type->char\( 4096 \)/);

  for (const field of ["DESCRIPTION", "TAGS_JSON", "METADATA_JSON"]) {
    assert.match(
      source,
      new RegExp(`add_field\\( '${field}' \\)->set_type\\([^\\r\\n]+[\\r\\n]+\\s*\\)->set_not_null\\( \\)`),
      `${field} must be NOT NULL`
    );
  }

  const classicCds = source.match(/METHOD create_classic_cds\.([\s\S]*?)ENDMETHOD\./)?.[1];
  assert.ok(classicCds, "missing classic CDS generator");
  assert.doesNotMatch(classicCds, /tags_json|\bTags\b/i);
});

test("Gateway V2 kit contains an importable contract and supported activation boundary", () => {
  const edmx = read("docs/downloads/sap/template-repository-v2.edmx");
  const activation = read("docs/downloads/sap/zui5_pdfme_activate_v2.prog.abap");
  const guide = read("examples/backend/sap/gateway-segw-v2/README.md");

  assert.match(edmx, /<EntityType Name="Template">/);
  assert.match(edmx, /<EntitySet Name="Templates"/);
  assert.match(edmx, /Name="ID" Type="Edm.String" Nullable="false" MaxLength="128"/);
  assert.match(edmx, /Name="Name" Type="Edm.String" Nullable="false" MaxLength="160"/);
  assert.match(edmx, /Name="Description" Type="Edm.String" Nullable="false" MaxLength="1024"/);
  assert.match(edmx, /Name="Tags" Type="Edm.String" Nullable="false" MaxLength="4096"/);
  assert.match(edmx, /Name="Version" Type="Edm.Int32" Nullable="false"/);
  for (const name of ["TemplateJson", "MappingJson", "MetadataJson", "DataSourcesJson"]) {
    const property = edmx.match(new RegExp(`<Property Name="${name}"[^>]*>`))?.[0];
    assert.ok(property, `missing ${name}`);
    assert.doesNotMatch(property, /MaxLength=/, `${name} must be unbounded in OData V2 metadata`);
  }
  for (const name of ["CreatedAt", "UpdatedAt"]) {
    const property = edmx.match(new RegExp(`<Property Name="${name}"[^>]*>`))?.[0];
    assert.match(property, /sap:creatable="false"/);
    assert.match(property, /sap:updatable="false"/);
  }

  assert.match(activation, /\/iwfnd\/cl_mgw_activation_api=>get_instance/);
  assert.match(activation, /->is_active/);
  assert.match(activation, /->activate_service/);
  assert.match(activation, /p_alias/);
  assert.match(activation, /p_pack/);
  assert.match(activation, /p_trkor/);
  assert.match(activation, /p_defcl AS CHECKBOX/);
  assert.match(activation, /iv_default_client = p_defcl/);
  assert.doesNotMatch(activation, /p_srv\s+TYPE[^\r\n]+DEFAULT/);
  assert.doesNotMatch(activation, /p_pref\s+TYPE[^\r\n]+DEFAULT/);
  assert.match(activation, /requested alias was not verified/i);
  assert.match(activation, /p_apply AS CHECKBOX DEFAULT abap_false/);

  assert.match(guide, /no universal released SAP API/i);
  assert.match(guide, /DPC_EXT/);
  assert.match(guide, /odataVersion: 2/);
});

test("classic CDS route is explicitly limited to a read-only catalog index", () => {
  const source = read("examples/backend/sap/classic-cds-v2/ZPDFME_CDS_TPL.asddls");
  const guide = read("examples/backend/sap/classic-cds-v2/README.md");

  assert.match(source, /@ObjectModel\.readOnly: true/);
  assert.match(source, /@OData\.publish: true/);
  assert.doesNotMatch(source, /tags_json|\bTags\b|TemplateJson|MappingJson|MetadataJson|DataSourcesJson/i);
  assert.match(guide, /read-only catalog index/i);
  assert.match(guide, /not a complete template repository/i);
});
