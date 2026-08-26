import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const templates = new Map();
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/;
const STATUSES = new Set(["draft", "published", "archived"]);
const json = (response, status, body, headers = {}) => {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  response.end(body == null ? "" : JSON.stringify(body));
};
const readBody = async (request) => {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 5_000_000) throw new Error("Payload too large");
  }
  return body ? JSON.parse(body) : {};
};
const validate = (record) => {
  if (!ID_PATTERN.test(record.id)) throw new Error("id must be an opaque identifier of 1 to 128 safe characters");
  if (typeof record.name !== "string" || !record.name.trim() || record.name.length > 160) throw new Error("name must contain 1 to 160 characters");
  if (typeof record.description !== "string" || record.description.length > 1024) throw new Error("description must contain at most 1024 characters");
  if (!Array.isArray(record.tags) || record.tags.length > 32) throw new Error("tags must be an array with at most 32 items");
  const tags = record.tags.map((tag) => {
    if (typeof tag !== "string" || !tag.trim() || tag.trim().length > 64) throw new Error("each tag must contain 1 to 64 characters");
    return tag.trim();
  });
  if (new Set(tags.map((tag) => tag.toLocaleLowerCase())).size !== tags.length) throw new Error("tags must be unique ignoring case");
  record.tags = tags;
  if (!STATUSES.has(record.status)) throw new Error("status must be draft, published, or archived");
  if (!/^[1-9][0-9]{0,9}$/.test(record.version) || Number(record.version) > 2_147_483_647) throw new Error("version must be between 1 and 2147483647");
  if (!record.template?.schemas || !Array.isArray(record.template.schemas)) throw new Error("a valid pdfme template is required");
  if (record.mapping != null && (typeof record.mapping !== "object" || Array.isArray(record.mapping))) throw new Error("mapping must be an object or null");
  if (!record.metadata || typeof record.metadata !== "object" || Array.isArray(record.metadata)) throw new Error("metadata must be an object");
  if (record.dataSources != null && !Array.isArray(record.dataSources)) throw new Error("dataSources must be an array, null, or omitted");
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    if (!url.pathname.startsWith("/api/templates")) return json(response, 404, { error: "Not found" });
    // Replace this demo check with the application's authenticated user/role middleware.
    const id = decodeURIComponent(url.pathname.slice("/api/templates/".length));
    if (request.method === "GET" && url.pathname === "/api/templates") {
      const search = (url.searchParams.get("search") || "").toLowerCase();
      const status = (url.searchParams.get("status") || "").toLowerCase();
      const items = [...templates.values()].filter((record) => {
        const haystack = `${record.name} ${record.description || ""} ${(record.tags || []).join(" ")}`.toLowerCase();
        return (!search || haystack.includes(search)) && (!status || record.status === status);
      }).map(({ template, mapping, ...summary }) => summary);
      return json(response, 200, { items, total: items.length });
    }
    if (request.method === "GET") {
      const record = templates.get(id);
      return record ? json(response, 200, record, { etag: `"${record.version}"` }) : json(response, 404, { error: "Template not found" });
    }
    if (request.method === "POST" || request.method === "PUT") {
      const input = await readBody(request);
      const recordId = request.method === "POST" ? (input.id || randomUUID()) : id;
      const previous = templates.get(recordId);
      if (previous && request.headers["if-match"] && request.headers["if-match"] !== `"${previous.version}"`) return json(response, 412, { error: "Template version conflict" });
      const now = new Date().toISOString();
      const record = {
        description: "", tags: [], status: "draft", metadata: {},
        ...previous, ...input, id: recordId,
        version: String(Number(previous?.version || 0) + 1),
        createdAt: previous?.createdAt || now, updatedAt: now
      };
      validate(record);
      templates.set(recordId, record);
      return json(response, previous ? 200 : 201, record, { etag: `"${record.version}"` });
    }
    return json(response, 405, { error: "Method not allowed" }, { allow: "GET, POST, PUT" });
  } catch (error) { return json(response, 400, { error: error.message }); }
});

server.listen(3000, "127.0.0.1", () => console.log("Template API: http://127.0.0.1:3000/api/templates"));
