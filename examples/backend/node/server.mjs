import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const templates = new Map();
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
  if (!record.name?.trim()) throw new Error("name is required");
  if (!record.template?.schemas || !Array.isArray(record.template.schemas)) throw new Error("a valid pdfme template is required");
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
      const record = { ...previous, ...input, id: recordId, version: String(Number(previous?.version || 0) + 1), createdAt: previous?.createdAt || now, updatedAt: now };
      validate(record);
      templates.set(recordId, record);
      return json(response, previous ? 200 : 201, record, { etag: `"${record.version}"` });
    }
    return json(response, 405, { error: "Method not allowed" }, { allow: "GET, POST, PUT" });
  } catch (error) { return json(response, 400, { error: error.message }); }
});

server.listen(3000, "127.0.0.1", () => console.log("Template API: http://127.0.0.1:3000/api/templates"));
