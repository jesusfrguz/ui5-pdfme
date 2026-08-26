import path from "node:path";

function positiveInteger(name, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value <= 0 || value > maximum) throw new Error(`${name} must be a positive integer no greater than ${maximum}`);
  return value;
}

export const config = Object.freeze({
  host: process.env.HOST || "127.0.0.1",
  port: positiveInteger("PORT", 3001, 65535),
  apiToken: process.env.API_TOKEN || "",
  corsOrigin: process.env.CORS_ORIGIN || "",
  databaseUrl: process.env.DATABASE_URL || "",
  outputDir: path.resolve(process.env.PDF_OUTPUT_DIR || path.join(process.cwd(), "output")),
  bodyLimit: positiveInteger("BODY_LIMIT_BYTES", 5_000_000, 50_000_000),
  pollInterval: positiveInteger("POLL_INTERVAL_MS", 1000, 60_000),
  maxAttempts: positiveInteger("MAX_ATTEMPTS", 3, 20),
  workerEnabled: !/^(0|false|no)$/i.test(process.env.WORKER_ENABLED || "true")
});
