"use strict";

const LIMITS = Object.freeze({
  id: 128,
  name: 160,
  description: 1024,
  tagsJson: 4096,
  tagCount: 32,
  tagLength: 64,
  payloadCharacters: 5_000_000,
  int32Max: 2_147_483_647
});

const STATUS_VALUES = new Set(["draft", "published", "archived"]);
const JSON_FIELDS = ["Tags", "TemplateJson", "MappingJson", "MetadataJson", "DataSourcesJson"];
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/;

function characterLength(value) {
  return [...String(value)].length;
}

function requireString(data, field, maxLength, { required = false } = {}) {
  const value = data[field];
  if (value == null) {
    if (required) throw new TypeError(`${field} is required`);
    return;
  }
  if (typeof value !== "string") throw new TypeError(`${field} must be a string`);
  if (required && !value.trim()) throw new TypeError(`${field} must not be empty`);
  if (characterLength(value) > maxLength) throw new RangeError(`${field} must not exceed ${maxLength} characters`);
}

function parseJson(data, field, predicate, expected, { required = false } = {}) {
  const source = data[field];
  if (source == null) {
    if (required) throw new TypeError(`${field} is required`);
    return source;
  }
  if (typeof source !== "string") throw new TypeError(`${field} must contain JSON text`);
  let value;
  try {
    value = JSON.parse(source);
  }
  catch {
    throw new TypeError(`${field} must contain valid JSON`);
  }
  if (!predicate(value)) throw new TypeError(`${field} must contain ${expected}`);
  return value;
}

function normalizeTags(data) {
  const tags = parseJson(data, "Tags", Array.isArray, "a JSON string array", { required: true });
  if (tags.length > LIMITS.tagCount) throw new RangeError(`Tags must contain at most ${LIMITS.tagCount} entries`);

  const normalized = tags.map((tag, index) => {
    if (typeof tag !== "string") throw new TypeError(`Tags[${index}] must be a string`);
    const value = tag.trim();
    const length = characterLength(value);
    if (length < 1 || length > LIMITS.tagLength) throw new RangeError(`Tags[${index}] must contain 1 to ${LIMITS.tagLength} characters`);
    return value;
  });
  const unique = new Set(normalized.map((tag) => tag.toLowerCase()));
  if (unique.size !== normalized.length) throw new TypeError("Tags must contain unique values");

  const encoded = JSON.stringify(normalized);
  if (characterLength(encoded) > LIMITS.tagsJson) throw new RangeError(`Tags JSON must not exceed ${LIMITS.tagsJson} characters`);
  data.Tags = encoded;
}

function normalizeVersion(data, { required = false } = {}) {
  if (data.Version == null) {
    if (required) throw new TypeError("Version is required");
    return;
  }
  const version = typeof data.Version === "string" && /^[1-9][0-9]*$/.test(data.Version)
    ? Number(data.Version)
    : data.Version;
  if (!Number.isInteger(version) || version < 1 || version > LIMITS.int32Max) {
    throw new RangeError("Version must be a positive Int32 value");
  }
  data.Version = version;
}

function validatePayload(data, { templateRequired = false } = {}) {
  const template = parseJson(
    data,
    "TemplateJson",
    (value) => Boolean(value && typeof value === "object" && !Array.isArray(value) && Array.isArray(value.schemas)),
    "a pdfme template object with a schemas array",
    { required: templateRequired }
  );
  if (template !== undefined && template !== null && !Array.isArray(template.schemas)) {
    throw new TypeError("TemplateJson must contain a pdfme schemas array");
  }
  parseJson(data, "MappingJson", (value) => value === null || (typeof value === "object" && !Array.isArray(value)), "an object or null");
  parseJson(data, "MetadataJson", (value) => Boolean(value && typeof value === "object" && !Array.isArray(value)), "an object");
  parseJson(data, "DataSourcesJson", Array.isArray, "an array");

  const payloadLength = JSON_FIELDS.reduce((total, field) => {
    return total + (typeof data[field] === "string" ? characterLength(data[field]) : 0);
  }, 0);
  if (payloadLength > LIMITS.payloadCharacters) {
    throw new RangeError(`Serialized JSON payload must not exceed ${LIMITS.payloadCharacters} characters`);
  }
}

function normalizeTemplateInput(data, { partial = false } = {}) {
  if (!data || typeof data !== "object") throw new TypeError("Template input must be an object");
  if (!partial) {
    data.Description ??= "";
    data.Tags ??= "[]";
    data.Status ??= "draft";
    data.Version ??= 1;
    data.MetadataJson ??= "{}";
  }

  requireString(data, "ID", LIMITS.id, { required: !partial });
  if (data.ID !== undefined && !ID_PATTERN.test(data.ID)) {
    throw new TypeError("ID must match ^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$");
  }
  if (typeof data.Name === "string") data.Name = data.Name.trim();
  requireString(data, "Name", LIMITS.name, { required: !partial });
  if (data.Name !== undefined && !data.Name) throw new TypeError("Name must not be empty");
  requireString(data, "Description", LIMITS.description);
  if (data.Tags !== undefined) normalizeTags(data);
  if (data.Status !== undefined) {
    requireString(data, "Status", 20, { required: true });
    if (!STATUS_VALUES.has(data.Status)) throw new TypeError("Status must be draft, published, or archived");
  }
  normalizeVersion(data, { required: !partial });
  validatePayload(data, { templateRequired: !partial });
  return data;
}

module.exports = { LIMITS, normalizeTemplateInput };
