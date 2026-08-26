sap.ui.define([], function () {
  "use strict";

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function parse(value, fallback) {
    if (value == null || value === "") { return fallback; }
    if (typeof value !== "string") { return value; }
    try { return JSON.parse(value); } catch (ignore) { return fallback; }
  }

  function value(record, names, fallback) {
    var index;
    for (index = 0; index < names.length; index += 1) {
      if (record && record[names[index]] !== undefined) { return record[names[index]]; }
    }
    return fallback;
  }

  function timestamp(input) {
    var match;
    var date;
    if (input instanceof Date) { return isNaN(input.getTime()) ? input : input.toISOString(); }
    if (typeof input === "string") {
      match = /^\/Date\((-?\d+)(?:([+-])(\d{4}))?\)\/$/.exec(input);
      if (match) {
        date = new Date(Number(match[1]) + (match[2] ? Number(match[3]) * 60000 * (match[2] === "+" ? 1 : -1) : 0));
        if (!isNaN(date.getTime())) { return date.toISOString(); }
      }
    }
    return input;
  }

  function id() {
    return globalThis.crypto && globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID() : "template-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
  }

  function normalize(input, repositoryId) {
    var raw = input || {};
    var tags = parse(value(raw, ["tags", "Tags"], []), []);
    var etag = value(raw, ["etag", "ETag", "@odata.etag"], raw.__metadata && raw.__metadata.etag);
    var record = {
      id: String(value(raw, ["id", "ID", "Id"], "")),
      name: String(value(raw, ["name", "Name", "title", "Title"], "")),
      description: String(value(raw, ["description", "Description"], "")),
      tags: Array.isArray(tags) ? tags.map(String) : String(tags || "").split(",").map(function (tag) { return tag.trim(); }).filter(Boolean),
      status: String(value(raw, ["status", "Status"], "draft")),
      version: String(value(raw, ["version", "Version"], "1")),
      updatedAt: timestamp(value(raw, ["updatedAt", "UpdatedAt", "modifiedAt", "ModifiedAt"], null)),
      createdAt: timestamp(value(raw, ["createdAt", "CreatedAt"], null)),
      template: parse(value(raw, ["template", "Template", "templateJson", "TemplateJson"], null), null),
      mapping: parse(value(raw, ["mapping", "Mapping", "mappingJson", "MappingJson"], null), null),
      metadata: parse(value(raw, ["metadata", "Metadata", "metadataJson", "MetadataJson"], {}), {}),
      repositoryId: repositoryId || raw.repositoryId || raw.RepositoryId || ""
    };
    if (etag !== undefined && etag !== null && etag !== "") { record.etag = String(etag); }
    var dataSources = parse(value(raw, ["dataSources", "DataSources", "dataSourcesJson", "DataSourcesJson"], undefined), undefined);
    if (dataSources !== undefined) { record.dataSources = dataSources; }
    if (!record.name) { record.name = record.id || "Untitled template"; }
    return record;
  }

  function filter(records, query) {
    var options = query || {};
    var search = String(options.search || options.query || "").trim().toLowerCase();
    var status = String(options.status || "").trim().toLowerCase();
    return records.filter(function (record) {
      var haystack = [record.name, record.description, record.status].concat(record.tags || []).join(" ").toLowerCase();
      return (!search || haystack.indexOf(search) >= 0) && (!status || record.status.toLowerCase() === status);
    }).sort(function (left, right) { return String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")); });
  }

  function storage(source, context) {
    var result = source.storage || context.storage || globalThis.localStorage;
    if (!result) { throw new Error("No storage implementation for template repository '" + source.id + "'"); }
    return result;
  }

  function mergeHeaders() {
    var output = {};
    Array.prototype.slice.call(arguments).filter(Boolean).forEach(function (group) {
      Object.keys(group).forEach(function (key) {
        var previous = Object.keys(output).find(function (candidate) { return candidate.toLowerCase() === key.toLowerCase(); });
        if (previous) { delete output[previous]; }
        output[key] = group[key];
      });
    });
    return output;
  }

  function stored(source, context) {
    var payload = parse(storage(source, context).getItem(source.storageKey || "ui5-pdfme.templates"), []);
    return Array.isArray(payload) ? payload : Object.keys(payload.records || {}).map(function (key) { return payload.records[key]; });
  }

  var memoryProvider = {
    list: function (source, query) {
      source.records = source.records || [];
      return filter(source.records.map(function (record) { return normalize(record, source.id); }), query);
    },
    get: function (source, recordId) {
      source.records = source.records || [];
      var found = source.records.find(function (record) { return String(value(record, ["id", "ID"], "")) === String(recordId); });
      return found ? normalize(clone(found), source.id) : null;
    },
    save: function (source, input) {
      source.records = source.records || [];
      var record = normalize(input, source.id);
      record.id = record.id || id();
      record.updatedAt = new Date().toISOString();
      record.createdAt = record.createdAt || record.updatedAt;
      var index = source.records.findIndex(function (item) { return String(value(item, ["id", "ID"], "")) === record.id; });
      if (index >= 0) { record.version = String(Number(normalize(source.records[index]).version || 0) + 1); source.records[index] = clone(record); } else { source.records.push(clone(record)); }
      return record;
    }
  };

  var localStorageProvider = {
    list: function (source, query, context) {
      return filter(stored(source, context).map(function (record) { return normalize(record, source.id); }), query);
    },
    get: function (source, recordId, context) {
      var found = stored(source, context).find(function (record) { return String(value(record, ["id", "ID"], "")) === String(recordId); });
      return found ? normalize(found, source.id) : null;
    },
    save: function (source, input, context) {
      var records = stored(source, context);
      var record = normalize(input, source.id);
      record.id = record.id || id();
      record.updatedAt = new Date().toISOString();
      record.createdAt = record.createdAt || record.updatedAt;
      var index = records.findIndex(function (item) { return String(value(item, ["id", "ID"], "")) === record.id; });
      if (index >= 0) { record.version = String(Number(normalize(records[index]).version || 0) + 1); records[index] = record; } else { records.push(record); }
      storage(source, context).setItem(source.storageKey || "ui5-pdfme.templates", JSON.stringify(records));
      return clone(record);
    }
  };

  function request(source, context, url, options) {
    var fetchImpl = source.fetch || context.fetch || globalThis.fetch;
    if (typeof fetchImpl !== "function") { throw new Error("No fetch implementation for template repository '" + source.id + "'"); }
    var settings = options || {};
    settings.credentials = settings.credentials || source.credentials || "same-origin";
    settings.headers = mergeHeaders(
      { accept: "application/json" },
      settings.body ? { "content-type": "application/json" } : null,
      source.headers,
      settings.headers
    );
    settings.signal = context.signal;
    return fetchImpl(url, settings).then(function (response) {
      if (!response.ok) { throw new Error("Template repository '" + source.id + "' failed with HTTP " + response.status); }
      return response.status === 204 ? null : response.json();
    });
  }

  function listPayload(payload) {
    if (Array.isArray(payload)) { return { items: payload }; }
    if (payload && Array.isArray(payload.items)) { return { items: payload.items, next: payload.next || payload.nextLink }; }
    if (payload && Array.isArray(payload.value)) { return { items: payload.value, next: payload["@odata.nextLink"] }; }
    if (payload && payload.d && Array.isArray(payload.d.results)) { return { items: payload.d.results, next: payload.d.__next }; }
    return { items: [] };
  }

  function withQuery(url, query) {
    var result = new URL(url, globalThis.location && globalThis.location.href || "http://localhost/");
    Object.keys(query || {}).forEach(function (key) {
      if (query[key] !== undefined && query[key] !== null && query[key] !== "") { result.searchParams.set(key, query[key]); }
    });
    return result.toString();
  }

  function continuationParameters(nextLink) {
    var result = {};
    var queryIndex = String(nextLink).indexOf("?");
    var query = queryIndex >= 0 ? String(nextLink).slice(queryIndex + 1).split("#", 1)[0] : "";
    var decode = function (part) {
      try { return decodeURIComponent(String(part).replace(/\+/g, " ")); } catch (ignore) { return String(part); }
    };
    query.split("&").filter(Boolean).forEach(function (pair) {
      var separator = pair.indexOf("=");
      var key = decode(separator >= 0 ? pair.slice(0, separator) : pair);
      result[key] = decode(separator >= 0 ? pair.slice(separator + 1) : "");
    });
    return result;
  }

  function readPages(source, context, url, output, page) {
    var records = output || [];
    var index = page || 0;
    return request(source, context, url).then(function (payload) {
      var unpacked = listPayload(payload);
      records.push.apply(records, unpacked.items);
      if (unpacked.next && source.followNext !== false && index + 1 < (source.maxPages || 100)) {
        return readPages(source, context, new URL(unpacked.next, url).toString(), records, index + 1);
      }
      return records;
    });
  }

  var restProvider = {
    list: function (source, query, context) {
      var url = withQuery(source.url, Object.assign({}, source.query || {}, { search: query.search, status: query.status, top: query.top, skip: query.skip }));
      return readPages(source, context, url).then(function (records) { return records.map(function (record) { return normalize(record, source.id); }); });
    },
    get: function (source, recordId, context) {
      var url = source.getUrl ? source.getUrl(recordId, source) : source.url.replace(/\/$/, "") + "/" + encodeURIComponent(recordId);
      return request(source, context, url).then(function (record) { return normalize(record && record.d || record, source.id); });
    },
    save: function (source, input, context) {
      var record = normalize(input, source.id);
      var create = !record.id;
      record.id = record.id || id();
      var url = create ? source.url : (source.getUrl ? source.getUrl(record.id, source) : source.url.replace(/\/$/, "") + "/" + encodeURIComponent(record.id));
      return request(source, context, url, { method: create ? source.createMethod || "POST" : source.updateMethod || "PUT", body: JSON.stringify(record) })
        .then(function (saved) { return normalize(saved || record, source.id); });
    }
  };

  function modelFor(source, context) {
    var owner = context.owner || context.control;
    return source.model || (owner && owner.getModel && owner.getModel(source.modelName)) || (context.models && context.models[source.modelName || "default"]);
  }

  function isV4(model) {
    return Boolean(model && model.isA && model.isA("sap.ui.model.odata.v4.ODataModel"));
  }

  function refreshV4Binding(binding, groupId, sourceId) {
    return new Promise(function (resolve, reject) {
      if (!binding || typeof binding.refresh !== "function" || typeof binding.attachEventOnce !== "function") {
        reject(new Error("Template repository '" + sourceId + "' cannot force a fresh OData V4 read"));
        return;
      }
      var received = function (event) {
        var error = event && event.getParameter && event.getParameter("error");
        if (error) { reject(error); return; }
        Promise.resolve(binding.requestObject()).then(resolve, reject);
      };
      binding.attachEventOnce("dataReceived", received);
      try { binding.refresh(groupId || "$direct"); }
      catch (error) {
        if (typeof binding.detachEvent === "function") { binding.detachEvent("dataReceived", received); }
        reject(error);
      }
    });
  }

  function odataEntity(record, create) {
    var versionText = String(record.version);
    if (!/^[1-9][0-9]*$/.test(versionText)) throw new RangeError("OData Version must be an Int32 between 1 and 2147483647 using canonical decimal digits");
    var version = Number(versionText);
    if (!Number.isInteger(version) || version > 2147483647) throw new RangeError("OData Version must be an Int32 between 1 and 2147483647 using canonical decimal digits");
    var entity = {
      Name: record.name,
      Description: record.description,
      Tags: JSON.stringify(record.tags || []),
      Status: record.status,
      Version: version,
      TemplateJson: JSON.stringify(record.template),
      MappingJson: JSON.stringify(record.mapping || null),
      MetadataJson: JSON.stringify(record.metadata || {}),
      DataSourcesJson: record.dataSources === undefined ? undefined : JSON.stringify(record.dataSources)
    };
    if (create) { entity.ID = record.id; }
    return entity;
  }

  function keyPath(source, recordId) {
    return source.path.replace(/\/$/, "") + "('" + String(recordId).replace(/'/g, "''") + "')";
  }

  function listSelect(source) {
    if (source.listSelect === false) { return undefined; }
    var fields = source.listSelect || ["ID", "Name", "Description", "Tags", "Status", "Version", "CreatedAt", "UpdatedAt"];
    return Array.isArray(fields) ? fields.join(",") : fields;
  }

  var odataProvider = {
    list: function (source, query, context) {
      var model = modelFor(source, context);
      if (!model) {
        return restProvider.list(Object.assign({}, source, { query: Object.assign({}, source.query || {}, { $filter: query.status ? "Status eq '" + String(query.status).replace(/'/g, "''") + "'" : undefined }) }), query, context);
      }
      if (isV4(model)) {
        var v4Parameters = Object.assign({}, source.query || {}, source.parameters || {});
        var v4Select = listSelect(source);
        if (v4Parameters.$select === undefined && v4Select !== undefined) { v4Parameters.$select = v4Select; }
        var binding = model.bindList(source.path, source.context, source.sorters, source.filters, v4Parameters);
        var pageSize = Math.max(1, Number(source.pageSize || 100));
        var maxRecords = source.maxRecords == null ? 10000 : Math.max(0, Number(source.maxRecords));
        if (!isFinite(pageSize)) { pageSize = 100; }
        if (!isFinite(maxRecords)) { maxRecords = 10000; }
        var load = function (skip, records) {
          var remaining = maxRecords - records.length;
          if (remaining <= 0) { return Promise.resolve(records.slice(0, maxRecords)); }
          var requested = Math.min(pageSize, remaining);
          return binding.requestContexts(skip, requested).then(function (contexts) {
            return Promise.all(contexts.map(function (itemContext) { return itemContext.requestObject ? itemContext.requestObject() : itemContext.getObject(); }));
          }).then(function (items) {
            var combined = records.concat(items).slice(0, maxRecords);
            return items.length === requested && combined.length < maxRecords ? load(skip + items.length, combined) : combined;
          });
        };
        return load(0, []).then(function (records) { return filter(records.map(function (record) { return normalize(record, source.id); }), query); });
      }
      return new Promise(function (resolve, reject) {
        var urlParameters = Object.assign({}, source.query || {}, source.urlParameters || {});
        var v2Select = listSelect(source);
        var maxPages = Math.max(1, Number(source.maxPages || 100));
        var maxRecords = source.maxRecords == null ? 10000 : Math.max(0, Number(source.maxRecords));
        var records = [];
        var pages = 0;
        if (urlParameters.$select === undefined && v2Select !== undefined) { urlParameters.$select = v2Select; }
        if (!isFinite(maxPages)) { maxPages = 100; }
        if (!isFinite(maxRecords)) { maxRecords = 10000; }
        var finish = function () {
          resolve(filter(records.slice(0, maxRecords).map(function (record) { return normalize(record, source.id); }), query));
        };
        var readPage = function (pageParameters, firstPage) {
          if (pages >= maxPages || records.length >= maxRecords) { finish(); return; }
          var settings = {
            success: function (data) {
              var items = data && data.results ? data.results : (data ? [data] : []);
              pages += 1;
              records = records.concat(items).slice(0, maxRecords);
              if (data && data.__next && pages < maxPages && records.length < maxRecords) { readPage(continuationParameters(data.__next), false); }
              else { finish(); }
            },
            error: reject
          };
          if (firstPage) {
            settings.filters = source.filters;
            settings.sorters = source.sorters;
            settings.urlParameters = urlParameters;
          } else { settings.urlParameters = pageParameters; }
          model.read(source.path, settings);
        };
        if (maxRecords === 0) { finish(); } else { readPage(urlParameters, true); }
      });
    },
    get: function (source, recordId, context) {
      var model = modelFor(source, context);
      if (!model) { return restProvider.get(Object.assign({}, source, { getUrl: function (key) { return source.url.replace(/\/$/, "") + "('" + encodeURIComponent(key) + "')"; } }), recordId, context); }
      if (isV4(model)) { return model.bindContext(keyPath(source, recordId), source.context, source.parameters || {}).requestObject().then(function (record) { return normalize(record, source.id); }); }
      return new Promise(function (resolve, reject) { model.read(keyPath(source, recordId), { success: function (record) { resolve(normalize(record, source.id)); }, error: reject }); });
    },
    save: function (source, input, context) {
      var model = modelFor(source, context);
      var record = normalize(input, source.id);
      var create = !record.id;
      record.id = record.id || id();
      var entity = odataEntity(record, create);
      if (!create && source.requireEtag === true && !record.etag) {
        return Promise.reject(new Error("Template repository '" + source.id + "' requires an ETag for OData updates"));
      }
      if (!model) {
        var httpUrl = create ? source.url : source.url.replace(/\/$/, "") + "('" + encodeURIComponent(record.id) + "')";
        var version = String(source.odataVersion || "4") === "2" ? "2" : "4";
        var httpEtag = record.etag || (source.requireEtag === true ? undefined : source.etag);
        return request(source, context, httpUrl, {
          method: create ? source.createMethod || "POST" : source.updateMethod || (version === "2" ? "MERGE" : "PATCH"),
          headers: !create && httpEtag ? { "if-match": httpEtag } : undefined,
          body: JSON.stringify(entity)
        }).then(function (saved) {
          if (!create && !saved) {
            return Promise.resolve(odataProvider.get(source, record.id, context)).then(function (refreshed) {
              if (!refreshed || !refreshed.id) { throw new Error("Template repository '" + source.id + "' updated the record but could not refresh it"); }
              return refreshed;
            });
          }
          var normalized = normalize(saved && saved.d || saved || Object.assign({ ID: record.id }, entity), source.id);
          if (!create && source.requireEtag === true && !normalized.etag) {
            return Promise.resolve(odataProvider.get(source, record.id, context)).then(function (refreshed) {
              if (!refreshed || !refreshed.id || !refreshed.etag) { throw new Error("Template repository '" + source.id + "' updated the record but did not return a fresh ETag"); }
              return refreshed;
            });
          }
          return normalized;
        });
      }
      if (isV4(model)) {
        if (create) {
          var created = model.bindList(source.path).create(entity);
          return created.created().then(function () { return created.requestObject(); }).then(function (saved) { return normalize(saved, source.id); });
        }
        var binding = model.bindContext(keyPath(source, record.id), source.context, { $$updateGroupId: source.updateGroupId || "$auto" });
        return binding.requestObject().then(function (current) {
          var boundContext = binding.getBoundContext();
          var currentEtag = value(current, ["etag", "ETag", "@odata.etag"], current && current.__metadata && current.__metadata.etag);
          if (record.etag && currentEtag && String(record.etag) !== String(currentEtag)) {
            throw new Error("Template repository '" + source.id + "' rejected an OData update because its ETag is stale");
          }
          if (source.requireEtag === true && !currentEtag) {
            throw new Error("Template repository '" + source.id + "' cannot verify the current ETag for an OData update");
          }
          var updates = Object.keys(entity).filter(function (field) { return entity[field] !== undefined; }).map(function (field) {
            return Promise.resolve(boundContext.setProperty(field, entity[field]));
          });
          var submitted = source.updateGroupId && model.submitBatch ? model.submitBatch(source.updateGroupId) : Promise.resolve();
          return Promise.all([submitted].concat(updates));
        }).then(function () { return refreshV4Binding(binding, source.refreshGroupId || "$direct", source.id); }).then(function (saved) { return normalize(saved, source.id); });
      }
      return new Promise(function (resolve, reject) {
        var settings = { success: function (saved) {
          if (saved) { resolve(normalize(saved, source.id)); }
          else { Promise.resolve(odataProvider.get(source, record.id, context)).then(resolve, reject); }
        }, error: reject };
        if (!create && record.etag) { settings.eTag = record.etag; }
        if (create) { model.create(source.path, entity, settings); } else { model.update(keyPath(source, record.id), entity, settings); }
      });
    }
  };

  var functionProvider = {
    list: function (source, query, context) { return source.list(query, context); },
    get: function (source, recordId, context) { return source.get(recordId, context); },
    save: function (source, record, context) { return source.save(record, context); }
  };

  function TemplateStore(repositories, options) {
    this.providers = { memory: memoryProvider, localStorage: localStorageProvider, rest: restProvider, odata: odataProvider, "function": functionProvider };
    this.context = options && options.context || {};
    this.configure(repositories || []);
  }

  TemplateStore.prototype.configure = function (repositories) {
    var list = Array.isArray(repositories) ? repositories : [repositories];
    this.repositories = list.filter(Boolean).map(function (source, index) { return Object.assign({ id: source.id || "templates-" + (index + 1) }, source); });
    return this;
  };

  TemplateStore.prototype.register = function (type, provider) {
    if (!type || !provider || !provider.list || !provider.get || !provider.save) { throw new TypeError("Template repository providers require list, get and save methods"); }
    this.providers[type] = provider;
    return this;
  };

  TemplateStore.prototype._source = function (repositoryId) {
    var source = repositoryId ? this.repositories.find(function (item) { return item.id === repositoryId; }) : this.repositories.find(function (item) { return item.default; }) || this.repositories[0];
    if (!source) { throw new Error(repositoryId ? "Template repository not found: " + repositoryId : "No template repository configured"); }
    return source;
  };

  TemplateStore.prototype.list = function (query) {
    var options = query || {};
    var sources = options.repositoryId ? [this._source(options.repositoryId)] : this.repositories;
    return Promise.all(sources.map(function (source) {
      var provider = this.providers[source.type];
      if (!provider) { throw new Error("Unknown template repository type: " + source.type); }
      return Promise.resolve(provider.list(source, options, this.context)).then(function (records) { return (records || []).map(function (record) { return normalize(record, source.id); }); });
    }, this)).then(function (groups) { return filter([].concat.apply([], groups), options); });
  };

  TemplateStore.prototype.get = function (recordId, options) {
    var source = this._source(options && options.repositoryId || recordId && recordId.repositoryId);
    var idValue = typeof recordId === "object" ? recordId.id : recordId;
    var provider = this.providers[source.type];
    return Promise.resolve(provider.get(source, idValue, this.context)).then(function (record) {
      if (!record) { throw new Error("Template not found: " + idValue); }
      return normalize(record, source.id);
    });
  };

  TemplateStore.prototype.save = function (input, options) {
    var source = this._source(options && options.repositoryId || input.repositoryId);
    var record = normalize(input, source.id);
    if (!record.template || !record.template.schemas) { throw new TypeError("A valid pdfme template is required"); }
    return Promise.resolve(this.providers[source.type].save(source, record, this.context)).then(function (saved) { return normalize(saved, source.id); });
  };

  TemplateStore.normalize = normalize;
  return TemplateStore;
});
