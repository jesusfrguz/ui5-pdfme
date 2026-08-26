const cloneValue = (value) => value == null ? value : (globalThis.structuredClone ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value)));

const parseJson = (value, fallback) => {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return fallback; }
};

const firstDefined = (record, names, fallback) => {
  for (const name of names) if (record?.[name] !== undefined) return record[name];
  return fallback;
};

const normalizeTimestamp = (value) => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? value : value.toISOString();
  if (typeof value === "string") {
    const match = /^\/Date\((-?\d+)(?:([+-])(\d{4}))?\)\/$/.exec(value);
    if (match) {
      const offset = match[2] ? Number(match[3]) * 60000 * (match[2] === "+" ? 1 : -1) : 0;
      const date = new Date(Number(match[1]) + offset);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
  }
  return value;
};

export function createTemplateId() {
  return globalThis.crypto?.randomUUID?.() || `template-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeTemplateRecord(value = {}, repositoryId) {
  const raw = value || {};
  const tags = parseJson(firstDefined(raw, ["tags", "Tags"], []), []);
  const etag = firstDefined(raw, ["etag", "ETag", "@odata.etag"], raw.__metadata?.etag);
  const record = {
    id: String(firstDefined(raw, ["id", "ID", "Id"], "")),
    name: String(firstDefined(raw, ["name", "Name", "title", "Title"], "")),
    description: String(firstDefined(raw, ["description", "Description"], "")),
    tags: Array.isArray(tags) ? tags.map(String) : String(tags || "").split(",").map((tag) => tag.trim()).filter(Boolean),
    status: String(firstDefined(raw, ["status", "Status"], "draft")),
    version: String(firstDefined(raw, ["version", "Version"], "1")),
    updatedAt: normalizeTimestamp(firstDefined(raw, ["updatedAt", "UpdatedAt", "modifiedAt", "ModifiedAt"], null)),
    createdAt: normalizeTimestamp(firstDefined(raw, ["createdAt", "CreatedAt"], null)),
    template: parseJson(firstDefined(raw, ["template", "Template", "templateJson", "TemplateJson"], null), null),
    mapping: parseJson(firstDefined(raw, ["mapping", "Mapping", "mappingJson", "MappingJson"], null), null),
    metadata: parseJson(firstDefined(raw, ["metadata", "Metadata", "metadataJson", "MetadataJson"], {}), {}),
    repositoryId: repositoryId || raw.repositoryId || raw.RepositoryId || ""
  };
  if (etag !== undefined && etag !== null && etag !== "") record.etag = String(etag);
  const dataSources = parseJson(firstDefined(raw, ["dataSources", "DataSources", "dataSourcesJson", "DataSourcesJson"], undefined), undefined);
  if (dataSources !== undefined) record.dataSources = dataSources;
  if (!record.name) record.name = record.id || "Untitled template";
  return record;
}

export function filterTemplateRecords(records, query = {}) {
  const search = String(query.search || query.query || "").trim().toLocaleLowerCase();
  const status = String(query.status || "").trim().toLocaleLowerCase();
  const requestedTags = (Array.isArray(query.tags) ? query.tags : String(query.tags || "").split(","))
    .map((tag) => String(tag).trim().toLocaleLowerCase()).filter(Boolean);
  let result = records.filter((record) => {
    const normalized = normalizeTemplateRecord(record, record.repositoryId);
    const haystack = `${normalized.name} ${normalized.description} ${normalized.tags.join(" ")} ${normalized.status}`.toLocaleLowerCase();
    return (!search || haystack.includes(search))
      && (!status || normalized.status.toLocaleLowerCase() === status)
      && (!requestedTags.length || requestedTags.every((tag) => normalized.tags.some((candidate) => candidate.toLocaleLowerCase() === tag)));
  });
  const direction = query.sortDirection === "asc" ? 1 : -1;
  const sortBy = query.sortBy || "updatedAt";
  result = result.sort((left, right) => direction * String(left[sortBy] || "").localeCompare(String(right[sortBy] || "")));
  const skip = Math.max(0, Number(query.skip || 0));
  const top = query.top == null ? result.length : Math.max(0, Number(query.top));
  return result.slice(skip, skip + top);
}

function storageFor(source, context) {
  const storage = source.storage || context.storage || globalThis.localStorage;
  if (!storage) throw new Error(`No storage implementation for template repository '${source.id}'`);
  return storage;
}

function readStoredRecords(source, context) {
  const payload = parseJson(storageFor(source, context).getItem(source.storageKey || "ui5-pdfme.templates"), []);
  return Array.isArray(payload) ? payload : Object.values(payload?.records || {});
}

function writeStoredRecords(source, context, records) {
  storageFor(source, context).setItem(source.storageKey || "ui5-pdfme.templates", JSON.stringify(records));
}

const memoryProvider = {
  list(source, query) {
    source.records ||= [];
    return filterTemplateRecords(source.records.map((record) => normalizeTemplateRecord(record, source.id)), query);
  },
  get(source, id) {
    source.records ||= [];
    const record = source.records.find((item) => String(firstDefined(item, ["id", "ID"], "")) === String(id));
    return record ? normalizeTemplateRecord(cloneValue(record), source.id) : null;
  },
  save(source, input) {
    source.records ||= [];
    const record = normalizeTemplateRecord(input, source.id);
    record.id ||= createTemplateId();
    record.updatedAt = new Date().toISOString();
    record.createdAt ||= record.updatedAt;
    const index = source.records.findIndex((item) => String(firstDefined(item, ["id", "ID"], "")) === record.id);
    if (index >= 0) {
      record.version = String(Number(normalizeTemplateRecord(source.records[index]).version || 0) + 1);
      source.records[index] = cloneValue(record);
    }
    else source.records.push(cloneValue(record));
    return record;
  }
};

const localStorageProvider = {
  list(source, query, context) {
    return filterTemplateRecords(readStoredRecords(source, context).map((record) => normalizeTemplateRecord(record, source.id)), query);
  },
  get(source, id, context) {
    const record = readStoredRecords(source, context).find((item) => String(firstDefined(item, ["id", "ID"], "")) === String(id));
    return record ? normalizeTemplateRecord(record, source.id) : null;
  },
  save(source, input, context) {
    const records = readStoredRecords(source, context);
    const record = normalizeTemplateRecord(input, source.id);
    record.id ||= createTemplateId();
    record.updatedAt = new Date().toISOString();
    record.createdAt ||= record.updatedAt;
    const index = records.findIndex((item) => String(firstDefined(item, ["id", "ID"], "")) === record.id);
    if (index >= 0) {
      record.version = String(Number(normalizeTemplateRecord(records[index]).version || 0) + 1);
      records[index] = record;
    }
    else records.push(record);
    writeStoredRecords(source, context, records);
    return cloneValue(record);
  }
};

function resolveFetch(source, context) {
  const fetchImpl = source.fetch || context.fetch || globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error(`No fetch implementation for template repository '${source.id}'`);
  return fetchImpl;
}

function appendQuery(url, values = {}) {
  const result = new URL(url, globalThis.location?.href || "http://localhost/");
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") result.searchParams.set(key, Array.isArray(value) ? value.join(",") : String(value));
  });
  return result;
}

function mergeHeaders(...groups) {
  const output = {};
  groups.filter(Boolean).forEach((group) => Object.entries(group).forEach(([key, value]) => {
    const previous = Object.keys(output).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    if (previous) delete output[previous];
    output[key] = value;
  }));
  return output;
}

async function requestJson(source, context, url, options = {}) {
  const { headers: optionHeaders = {}, ...requestOptions } = options;
  const headers = mergeHeaders(
    { accept: "application/json", ...(options.body ? { "content-type": "application/json" } : {}) },
    source.headers,
    optionHeaders
  );
  const response = await resolveFetch(source, context)(url, {
    credentials: source.credentials || "same-origin",
    signal: context.signal,
    ...requestOptions,
    headers
  });
  if (!response.ok) throw new Error(`Template repository '${source.id}' failed with HTTP ${response.status}`);
  if (response.status === 204) return null;
  return response.json();
}

function unpackList(payload) {
  if (Array.isArray(payload)) return { items: payload };
  if (Array.isArray(payload?.items)) return { items: payload.items, next: payload.next || payload.nextLink, total: payload.total };
  if (Array.isArray(payload?.value)) return { items: payload.value, next: payload["@odata.nextLink"], total: payload["@odata.count"] };
  if (Array.isArray(payload?.d?.results)) return { items: payload.d.results, next: payload.d.__next };
  return { items: [] };
}

async function readAllPages(source, context, firstUrl) {
  const records = [];
  let url = firstUrl;
  const maxPages = Number(source.maxPages || 100);
  for (let page = 0; url && page < maxPages; page += 1) {
    const payload = await requestJson(source, context, url);
    const unpacked = unpackList(payload);
    records.push(...unpacked.items);
    url = source.followNext === false ? null : unpacked.next;
    if (url) url = new URL(url, firstUrl).toString();
  }
  return records;
}

const restProvider = {
  async list(source, query, context) {
    const url = appendQuery(source.url, {
      ...(source.query || {}),
      [source.searchParameter || "search"]: query.search || query.query,
      [source.statusParameter || "status"]: query.status,
      [source.tagsParameter || "tags"]: query.tags,
      [source.topParameter || "top"]: query.top,
      [source.skipParameter || "skip"]: query.skip
    }).toString();
    const records = await readAllPages(source, context, url);
    return records.map((record) => normalizeTemplateRecord(source.mapRecord ? source.mapRecord(record) : record, source.id));
  },
  async get(source, id, context) {
    const url = source.getUrl ? source.getUrl(id, source) : `${source.url.replace(/\/$/, "")}/${encodeURIComponent(id)}`;
    const payload = await requestJson(source, context, url);
    return payload ? normalizeTemplateRecord(source.mapRecord ? source.mapRecord(payload) : payload, source.id) : null;
  },
  async save(source, input, context) {
    const record = normalizeTemplateRecord(input, source.id);
    const isCreate = !record.id;
    record.id ||= createTemplateId();
    const url = isCreate ? source.url : (source.getUrl ? source.getUrl(record.id, source) : `${source.url.replace(/\/$/, "")}/${encodeURIComponent(record.id)}`);
    const body = source.serializeRecord ? source.serializeRecord(record) : record;
    const payload = await requestJson(source, context, url, { method: isCreate ? (source.createMethod || "POST") : (source.updateMethod || "PUT"), body: JSON.stringify(body) });
    return normalizeTemplateRecord(source.mapRecord ? source.mapRecord(payload || body) : (payload || body), source.id);
  }
};

const odataFields = {
  id: "ID", name: "Name", description: "Description", tags: "Tags", status: "Status", version: "Version",
  updatedAt: "UpdatedAt", createdAt: "CreatedAt", template: "TemplateJson", mapping: "MappingJson", metadata: "MetadataJson", dataSources: "DataSourcesJson"
};

function odataFilter(query, fields, version = "4") {
  const clauses = [];
  const escape = (value) => String(value).replace(/'/g, "''");
  if (query.search || query.query) {
    const value = escape(query.search || query.query);
    const searchable = [fields.name, fields.description, fields.tags];
    clauses.push(version === "2"
      ? `(${searchable.map((field) => `substringof('${value}',${field}) eq true`).join(" or ")})`
      : `(${searchable.map((field) => `contains(tolower(${field}),tolower('${value}'))`).join(" or ")})`);
  }
  if (query.status) clauses.push(`${fields.status} eq '${escape(query.status)}'`);
  return clauses.join(" and ");
}

function odataInt32(value) {
  const text = String(value);
  if (!/^[1-9][0-9]*$/.test(text)) throw new RangeError("OData Version must be an Int32 between 1 and 2147483647 using canonical decimal digits");
  const number = Number(text);
  if (!Number.isInteger(number) || number > 2_147_483_647) throw new RangeError("OData Version must be an Int32 between 1 and 2147483647 using canonical decimal digits");
  return number;
}

function serializeOData(record, source, isCreate) {
  const fields = { ...odataFields, ...(source.fields || {}) };
  const output = {};
  Object.entries(fields).forEach(([key, field]) => {
    if (record[key] === undefined) return;
    if (["createdAt", "updatedAt"].includes(key) && source.writeAuditFields !== true) return;
    if (key === "id" && !isCreate) return;
    if (key === "version") output[field] = odataInt32(record[key]);
    else output[field] = ["template", "mapping", "metadata", "dataSources", "tags"].includes(key) ? JSON.stringify(record[key]) : record[key];
  });
  return output;
}

function odataKeyUrl(source, id) {
  if (source.getUrl) return source.getUrl(id, source);
  const escaped = String(id).replace(/'/g, "''");
  return `${source.url.replace(/\/$/, "")}('${encodeURIComponent(escaped)}')`;
}

function odataListSelect(source, fields) {
  if (source.listSelect === false) return undefined;
  const selected = source.listSelect || ["id", "name", "description", "tags", "status", "version", "createdAt", "updatedAt"].map((key) => fields[key]);
  return Array.isArray(selected) ? selected.join(",") : selected;
}

const odataProvider = {
  async list(source, query, context) {
    const fields = { ...odataFields, ...(source.fields || {}) };
    const version = String(source.odataVersion || "4") === "2" ? "2" : "4";
    const filters = [source.query?.$filter, odataFilter(query, fields, version)].filter(Boolean);
    const url = appendQuery(source.url, {
      ...(source.query || {}),
      $select: source.query?.$select || odataListSelect(source, fields),
      $filter: filters.map((filter) => `(${filter})`).join(" and "),
      $top: query.top,
      $skip: query.skip,
      ...(version === "2"
        ? { $inlinecount: source.count === false ? undefined : "allpages" }
        : { $count: source.count === false ? undefined : "true" })
    }).toString();
    const records = await readAllPages({ ...source, followNext: source.followNext !== false }, context, url);
    return records.map((record) => normalizeTemplateRecord(record, source.id));
  },
  async get(source, id, context) {
    const payload = await requestJson(source, context, odataKeyUrl(source, id));
    return payload == null ? null : normalizeTemplateRecord(payload?.d || payload, source.id);
  },
  async save(source, input, context) {
    const record = normalizeTemplateRecord(input, source.id);
    const isCreate = !record.id;
    record.id ||= createTemplateId();
    if (!isCreate && source.requireEtag === true && !record.etag) {
      throw new Error(`Template repository '${source.id}' requires an ETag for OData updates`);
    }
    const etag = record.etag || (source.requireEtag === true ? undefined : source.etag);
    const body = serializeOData(record, source, isCreate);
    const version = String(source.odataVersion || "4") === "2" ? "2" : "4";
    const payload = await requestJson(source, context, isCreate ? source.url : odataKeyUrl(source, record.id), {
      method: isCreate ? (source.createMethod || "POST") : (source.updateMethod || (version === "2" ? "MERGE" : "PATCH")),
      headers: !isCreate && etag ? { "if-match": etag } : undefined,
      body: JSON.stringify(body)
    });
    const fields = { ...odataFields, ...(source.fields || {}) };
    if (!isCreate && payload == null) {
      const refreshed = await odataProvider.get(source, record.id, context);
      if (!refreshed?.id) throw new Error(`Template repository '${source.id}' updated the record but could not refresh it`);
      return refreshed;
    }
    const saved = normalizeTemplateRecord(payload?.d || payload || { [fields.id]: record.id, ...body }, source.id);
    if (!isCreate && source.requireEtag === true && !saved.etag) {
      const refreshed = await odataProvider.get(source, record.id, context);
      if (!refreshed?.id || !refreshed.etag) throw new Error(`Template repository '${source.id}' updated the record but did not return a fresh ETag`);
      return refreshed;
    }
    return saved;
  }
};

const functionProvider = {
  list: (source, query, context) => source.list(query, context),
  get: (source, id, context) => source.get(id, context),
  save: (source, record, context) => source.save(record, context)
};

export class TemplateRepositoryRegistry {
  constructor() {
    this.providers = new Map();
    this.register("memory", memoryProvider)
      .register("localStorage", localStorageProvider)
      .register("rest", restProvider)
      .register("odata", odataProvider)
      .register("function", functionProvider);
  }

  register(type, provider) {
    if (!type || !provider?.list || !provider?.get || !provider?.save) throw new TypeError("Template repository providers require list, get and save methods");
    this.providers.set(type, provider);
    return this;
  }

  get(type) {
    const provider = this.providers.get(type);
    if (!provider) throw new Error(`Unknown template repository type: ${type}`);
    return provider;
  }
}

export class TemplateStore {
  constructor(repositories = [], options = {}) {
    this.registry = options.registry || new TemplateRepositoryRegistry();
    this.context = options.context || {};
    this.configure(repositories);
  }

  configure(repositories = []) {
    const list = Array.isArray(repositories) ? repositories : [repositories];
    this.repositories = list.filter(Boolean).map((source, index) => ({ id: source.id || `templates-${index + 1}`, ...source }));
    return this;
  }

  register(type, provider) { this.registry.register(type, provider); return this; }

  source(id) {
    const source = id ? this.repositories.find((item) => item.id === id) : (this.repositories.find((item) => item.default) || this.repositories[0]);
    if (!source) throw new Error(id ? `Template repository not found: ${id}` : "No template repository configured");
    return source;
  }

  async list(query = {}) {
    const sources = query.repositoryId ? [this.source(query.repositoryId)] : this.repositories;
    const nested = await Promise.all(sources.map(async (source) => {
      const result = await this.registry.get(source.type).list(source, query, this.context);
      return (result || []).map((record) => normalizeTemplateRecord(record, source.id));
    }));
    return filterTemplateRecords(nested.flat(), { ...query, skip: 0, top: undefined });
  }

  async get(id, options = {}) {
    const source = this.source(options.repositoryId || (typeof id === "object" && id.repositoryId));
    const recordId = typeof id === "object" ? id.id : id;
    const record = await this.registry.get(source.type).get(source, recordId, this.context);
    if (!record) throw new Error(`Template not found: ${recordId}`);
    return normalizeTemplateRecord(record, source.id);
  }

  async save(input, options = {}) {
    const source = this.source(options.repositoryId || input.repositoryId);
    const record = normalizeTemplateRecord(input, source.id);
    if (!record.template?.schemas) throw new TypeError("A valid pdfme template is required");
    const saved = await this.registry.get(source.type).save(source, record, this.context);
    return normalizeTemplateRecord(saved, source.id);
  }
}
