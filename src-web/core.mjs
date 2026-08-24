export function tokenizePath(path) {
  if (Array.isArray(path)) return [...path];
  return String(path ?? "")
    .replace(/^\$\./, "")
    .replace(/\[(?:'([^']+)'|"([^"]+)"|(\d+))\]/g, (_match, single, double, index) => `.${single || double || index}`)
    .replace(/^\//, "")
    .split(/[./]/)
    .filter(Boolean);
}

export function getPath(object, path, defaultValue) {
  if (path === "" || path == null || path === "$" || path === ".") return object;
  let value = object;
  for (const part of tokenizePath(path)) {
    if (value == null || !Object.prototype.hasOwnProperty.call(Object(value), part)) return defaultValue;
    value = value[part];
  }
  return value;
}

export function flattenData(object, { maxDepth = 6, includeArrays = true } = {}) {
  const result = [];
  const visit = (value, path, depth) => {
    if (depth > maxDepth || value == null || value instanceof Date) {
      if (path) result.push({ path, value, kind: "value" });
      return;
    }
    if (Array.isArray(value)) {
      if (includeArrays && path) result.push({ path, value, kind: "array" });
      if (value.length && depth < maxDepth) visit(value[0], path ? `${path}[0]` : "[0]", depth + 1);
      return;
    }
    if (typeof value === "object") {
      const keys = Object.keys(value);
      if (!keys.length && path) result.push({ path, value, kind: "object" });
      keys.forEach((key) => visit(value[key], path ? `${path}.${key}` : key, depth + 1));
      return;
    }
    if (path) result.push({ path, value, kind: typeof value });
  };
  visit(object, "", 0);
  return result;
}

export const FIXED_POSITION_VALUE_PREFIX = "\u0000ui5-pdfme-fixed:";
const FIXED_INPUT_ALIAS = "__ui5PdfmeFixedInputAlias";
const FIXED_INPUT_NAME = "__ui5PdfmeFixedInputName";

function reserveRepeatedFixedFieldMargins(basePdf, fixedSchemas) {
  const pageHeight = Number(basePdf.height);
  if (!Number.isFinite(pageHeight) || pageHeight <= 0) return basePdf.padding;

  const padding = basePdf.padding.map((value) => Number(value) || 0);
  fixedSchemas.forEach((schema) => {
    if (schema.repeatOnEveryPage !== true) return;
    const y = Number(schema.position?.y);
    const height = Number(schema.height);
    if (!Number.isFinite(y) || !Number.isFinite(height) || height < 0) return;

    const top = Math.max(0, Math.min(pageHeight, y));
    const bottom = Math.max(top, Math.min(pageHeight, y + height));
    if ((top + bottom) / 2 <= pageHeight / 2) {
      padding[0] = Math.max(padding[0], bottom);
    } else {
      padding[2] = Math.max(padding[2], pageHeight - top);
    }
  });
  return padding;
}

export function prepareTemplateForGeneration(template) {
  const basePdf = template?.basePdf;
  if (!basePdf || typeof basePdf !== "object" || !Array.isArray(basePdf.padding) || !Array.isArray(template?.schemas)) {
    return template;
  }

  const fixedSchemas = [];
  const schemas = template.schemas.map((page, pageIndex) => (Array.isArray(page) ? page : []).filter((schema, schemaIndex) => {
    const fixed = schema?.fixedPosition === true;
    if (fixed) {
      const repeats = schema.repeatOnEveryPage === true;
      const inputAlias = schema.readOnly === true ? null : `__ui5PdfmeFixed_${pageIndex}_${schemaIndex}`;
      const content = inputAlias ? `{${inputAlias}}` : (schema.content || "");
      fixedSchemas.push({
        ...schema,
        readOnly: true,
        content: repeats
          ? content
          : `${FIXED_POSITION_VALUE_PREFIX}${pageIndex + 1}:{currentPage}\u0000${content}`,
        required: false,
        ...(inputAlias ? { [FIXED_INPUT_ALIAS]: inputAlias, [FIXED_INPUT_NAME]: schema.name } : {})
      });
    }
    return !fixed;
  }));
  if (!fixedSchemas.length) return template;

  const fixedNames = new Set(fixedSchemas.map(({ name }) => name));
  const existingStaticSchemas = Array.isArray(basePdf.staticSchema)
    ? basePdf.staticSchema.filter(({ name }) => !fixedNames.has(name))
    : [];
  return {
    ...template,
    basePdf: {
      ...basePdf,
      padding: reserveRepeatedFixedFieldMargins(basePdf, fixedSchemas),
      staticSchema: [...existingStaticSchemas, ...fixedSchemas]
    },
    schemas
  };
}

export function prepareInputsForGeneration(template, inputs) {
  const bindings = Array.isArray(template?.basePdf?.staticSchema)
    ? template.basePdf.staticSchema.filter((schema) => schema?.[FIXED_INPUT_ALIAS] && schema?.[FIXED_INPUT_NAME])
    : [];
  if (!bindings.length || !Array.isArray(inputs)) return inputs;
  return inputs.map((input) => {
    const prepared = { ...(input || {}) };
    bindings.forEach((schema) => {
      prepared[schema[FIXED_INPUT_ALIAS]] = input?.[schema[FIXED_INPUT_NAME]] ?? "";
    });
    return prepared;
  });
}

export class DataProviderRegistry {
  constructor() {
    this.providers = new Map();
  }

  register(type, provider) {
    if (!type || (!provider?.resolve && typeof provider !== "function")) {
      throw new TypeError("A provider type and resolve function are required");
    }
    this.providers.set(type, provider);
    return this;
  }

  unregister(type) {
    this.providers.delete(type);
    return this;
  }

  get(type) {
    const provider = this.providers.get(type);
    if (!provider) throw new Error(`Unknown PDF data provider: ${type}`);
    return provider;
  }

  resolve(source, context = {}) {
    const provider = this.get(source.type);
    const resolver = typeof provider === "function" ? provider : provider.resolve.bind(provider);
    return Promise.resolve(resolver(source, context));
  }
}

const jsonProvider = {
  resolve(source) {
    return Object.prototype.hasOwnProperty.call(source, "data") ? source.data : source.value;
  }
};

const functionProvider = {
  resolve(source, context) {
    const loader = source.resolve || context.loaders?.[source.loader];
    if (typeof loader !== "function") throw new Error(`Loader not found for source ${source.id}`);
    return loader(source, context);
  }
};

async function fetchJsonSource(source, context) {
  const fetchImpl = source.fetch || context.fetch || globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error(`No fetch implementation for source ${source.id}`);
  if (!source.url) throw new Error(`Source ${source.id} requires a URL`);
  const url = new URL(source.url, globalThis.location?.href || "http://localhost/");
  Object.entries(source.query || {}).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetchImpl(url, {
    method: source.method || "GET",
    headers: source.headers,
    body: source.body,
    credentials: source.credentials || "same-origin",
    signal: context.signal
  });
  if (!response.ok) throw new Error(`Source ${source.id} failed with HTTP ${response.status}`);
  if (source.responseType === "text") return response.text();
  if (source.responseType === "blob") return response.blob();
  return response.json();
}

const restProvider = { resolve: fetchJsonSource };

const odataProvider = {
  async resolve(source, context) {
    const payload = await fetchJsonSource(source, context);
    if (source.unwrap === false) return payload;
    if (payload?.d?.results) return payload.d.results;
    if (payload?.d !== undefined) return payload.d;
    if (Array.isArray(payload?.value)) return payload.value;
    return payload;
  }
};

export function createDefaultRegistry() {
  return new DataProviderRegistry()
    .register("json", jsonProvider)
    .register("function", functionProvider)
    .register("rest", restProvider)
    .register("odata", odataProvider);
}

export class DataResolver {
  constructor(registry = createDefaultRegistry()) {
    this.registry = registry;
  }

  async resolve(sources = [], context = {}) {
    let pending = [...sources];
    const result = {};
    const ids = new Set();
    const runtime = { ...context, data: result };
    pending.forEach((source) => {
      if (!source?.id || !source?.type) throw new Error("Each data source requires a unique id and type");
      if (ids.has(source.id)) throw new Error(`Duplicate data source id: ${source.id}`);
      ids.add(source.id);
    });
    while (pending.length) {
      const ready = pending.filter((source) => (source.dependsOn || []).every((id) => Object.hasOwn(result, id)));
      if (!ready.length) throw new Error(`Circular or missing data-source dependency: ${pending.map(({ id }) => id).join(", ")}`);
      await Promise.all(ready.map(async (source) => {
        try {
          result[source.id] = await this.registry.resolve(source, runtime);
        } catch (error) {
          if (source.optional) result[source.id] = source.defaultValue;
          else throw new Error(`Data source '${source.id}': ${error.message}`, { cause: error });
        }
      }));
      pending = pending.filter((source) => !ready.includes(source));
    }
    return result;
  }
}

const asString = (value) => {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export class MappingEngine {
  constructor(formatters = {}) {
    this.formatters = {
      raw: (value) => value,
      json: (value) => JSON.stringify(value ?? null),
      join: (value, options) => Array.isArray(value) ? value.join(options?.separator || ", ") : value,
      number: (value, options) => new Intl.NumberFormat(options?.locale, options || {}).format(Number(value || 0)),
      date: (value, options) => value ? new Intl.DateTimeFormat(options?.locale, options || {}).format(new Date(value)) : "",
      table: (value, options) => {
        const rows = Array.isArray(value) ? value : [];
        const columns = options?.columns || [];
        const matrix = columns.length
          ? rows.map((row) => columns.map((column) => asString(getPath(row, typeof column === "string" ? column : column.path, column?.defaultValue))))
          : rows.map((row) => Array.isArray(row) ? row : [row]);
        return JSON.stringify(matrix);
      },
      ...formatters
    };
  }

  registerFormatter(name, formatter) {
    if (!name || typeof formatter !== "function") throw new TypeError("Formatter name and function are required");
    this.formatters[name] = formatter;
    return this;
  }

  resolveField(definition, data) {
    let value;
    let formatter;
    let options;
    if (typeof definition === "string") value = getPath(data, definition);
    else if (definition && typeof definition === "object" && !Array.isArray(definition)) {
      if (Object.hasOwn(definition, "value")) value = definition.value;
      else if (Object.hasOwn(definition, "variables")) {
        const variables = Array.isArray(definition.variables)
          ? Object.fromEntries(definition.variables.map((name) => [name, name]))
          : definition.variables || {};
        value = Object.fromEntries(Object.entries(variables).map(([name, variableDefinition]) => [
          name,
          this.resolveField(variableDefinition, data)
        ]));
      }
      else if (Object.hasOwn(definition, "template")) {
        value = String(definition.template).replace(/\{([^{}]+)\}/g, (_match, path) => asString(getPath(data, path.trim(), "")));
      } else value = getPath(data, definition.path, definition.defaultValue);
      formatter = definition.formatter;
      options = definition.options || definition;
    } else value = definition;
    if (formatter) {
      const format = typeof formatter === "function" ? formatter : this.formatters[formatter];
      if (!format) throw new Error(`Unknown PDF mapping formatter: ${formatter}`);
      value = format(value, options, data);
    }
    return asString(value);
  }

  map(data, fields = {}) {
    return Object.fromEntries(Object.entries(fields).map(([name, definition]) => [name, this.resolveField(definition, data)]));
  }

  mapInputs(data, definition = {}) {
    const fields = definition.fields || definition;
    if (!definition.repeat) return [this.map(data, fields)];
    const records = getPath(data, definition.repeat, []);
    if (!Array.isArray(records)) throw new Error(`Mapping repeat path must resolve to an array: ${definition.repeat}`);
    return records.map((record, index) => this.map({ ...data, $item: record, $index: index }, fields));
  }
}
