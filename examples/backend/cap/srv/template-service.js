"use strict";

const cds = require("@sap/cds");
const { LIMITS, normalizeTemplateInput } = require("./template-contract");

function rejectInvalid(request, callback) {
  try {
    return callback();
  }
  catch (error) {
    return request.reject(400, error.message);
  }
}

module.exports = class PdfTemplateService extends cds.ApplicationService {
  init() {
    const { Templates } = this.entities;

    this.before("CREATE", Templates, (request) => {
      request.data.ID ||= cds.utils.uuid();
      rejectInvalid(request, () => normalizeTemplateInput(request.data));
    });

    this.before("UPDATE", Templates, async (request) => {
      rejectInvalid(request, () => normalizeTemplateInput(request.data, { partial: true }));
      const ID = request.data.ID || request.params?.find((parameter) => parameter?.ID)?.ID;
      if (!ID) return request.reject(400, "ID is required for updates");
      if (!request.headers?.["if-match"]) return request.reject(428, "If-Match is required for optimistic concurrency");

      const { PdfTemplates } = cds.entities("ui5.pdfme");
      const { SELECT } = cds.ql;
      const current = await cds.tx(request).run(
        SELECT.one.from(PdfTemplates).columns("version").where({ ID })
      );
      if (!current) return request.reject(404, `Template not found: ${ID}`);
      if (request.data.Version != null && request.data.Version !== current.version) return request.reject(412, "Template version conflict");
      if (current.version >= LIMITS.int32Max) return request.reject(409, "Template version has reached the Int32 limit");
      request.data.Version = current.version + 1;
    });

    return super.init();
  }
};
