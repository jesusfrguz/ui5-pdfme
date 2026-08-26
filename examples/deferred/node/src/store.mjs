import { randomUUID } from "node:crypto";

const clone = (value) => value == null ? value : structuredClone(value);

function publicJob(job) {
  if (!job) return null;
  const { payload, resultPath, ...result } = job;
  return clone(result);
}

export class MemoryStore {
  constructor() {
    this.templates = new Map();
    this.jobs = new Map();
  }
  async initialize() {}
  async close() {}
  async listTemplates() { return [...this.templates.values()].map(clone); }
  async getTemplate(id) { return clone(this.templates.get(id)); }
  async saveTemplate(input) {
    const previous = this.templates.get(input.id);
    const now = new Date().toISOString();
    const record = { ...previous, ...clone(input), version: Number(previous?.version || 0) + 1, createdAt: previous?.createdAt || now, updatedAt: now };
    this.templates.set(record.id, record);
    return clone(record);
  }
  async findJobByIdempotencyKey(key) {
    if (!key) return null;
    return publicJob([...this.jobs.values()].find((job) => job.idempotencyKey === key));
  }
  async createJob(input) {
    const now = new Date().toISOString();
    const job = { id: randomUUID(), status: "QUEUED", attempts: 0, createdAt: now, updatedAt: now, ...clone(input) };
    this.jobs.set(job.id, job);
    return publicJob(job);
  }
  async getJob(id, { internal = false } = {}) {
    const job = this.jobs.get(id);
    return internal ? clone(job) : publicJob(job);
  }
  async claimNextJob() {
    const now = Date.now();
    const job = [...this.jobs.values()]
      .filter((item) => item.status === "QUEUED" && Date.parse(item.runAt) <= now)
      .sort((a, b) => Date.parse(a.runAt) - Date.parse(b.runAt))[0];
    if (!job) return null;
    job.status = "RUNNING";
    job.attempts += 1;
    job.updatedAt = new Date().toISOString();
    return clone(job);
  }
  async completeJob(id, result) {
    const job = this.jobs.get(id);
    Object.assign(job, result, { status: "DONE", updatedAt: new Date().toISOString(), errorMessage: null });
    return publicJob(job);
  }
  async failJob(id, errorMessage, retry) {
    const job = this.jobs.get(id);
    Object.assign(job, { status: retry ? "QUEUED" : "FAILED", errorMessage, updatedAt: new Date().toISOString() });
    return publicJob(job);
  }
  async getResultPath(id) { return this.jobs.get(id)?.resultPath || null; }
}

const schemaSql = `
CREATE TABLE IF NOT EXISTS pdf_templates_deferred (
  id varchar(128) PRIMARY KEY,
  name varchar(160) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  template_json jsonb NOT NULL,
  mapping_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pdf_generation_jobs (
  id uuid PRIMARY KEY,
  template_id varchar(128) NOT NULL REFERENCES pdf_templates_deferred(id),
  template_version integer,
  status varchar(20) NOT NULL,
  run_at timestamptz NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  filename varchar(255) NOT NULL,
  result_path text,
  input_count integer,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  idempotency_key varchar(128) UNIQUE,
  error_message text,
  requested_by varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pdf_generation_jobs_queue_idx ON pdf_generation_jobs(status, run_at);
`;

const templateFromRow = (row) => row && ({ id: row.id, name: row.name, status: row.status, version: row.version, template: row.template_json, mapping: row.mapping_json, metadata: row.metadata_json, createdAt: row.created_at?.toISOString?.() || row.created_at, updatedAt: row.updated_at?.toISOString?.() || row.updated_at });
const jobFromRow = (row, internal = false) => row && ({ id: row.id, templateId: row.template_id, templateVersion: row.template_version, status: row.status, runAt: row.run_at?.toISOString?.() || row.run_at, filename: row.filename, inputCount: row.input_count, attempts: row.attempts, maxAttempts: row.max_attempts, idempotencyKey: row.idempotency_key, errorMessage: row.error_message, requestedBy: row.requested_by, createdAt: row.created_at?.toISOString?.() || row.created_at, updatedAt: row.updated_at?.toISOString?.() || row.updated_at, ...(internal ? { payload: row.payload_json, resultPath: row.result_path } : {}) });

export class PostgresStore {
  constructor(pool) { this.pool = pool; }
  async initialize() { await this.pool.query(schemaSql); }
  async close() { await this.pool.end(); }
  async listTemplates() { return (await this.pool.query("SELECT * FROM pdf_templates_deferred ORDER BY name")).rows.map(templateFromRow); }
  async getTemplate(id) { return templateFromRow((await this.pool.query("SELECT * FROM pdf_templates_deferred WHERE id=$1", [id])).rows[0]); }
  async saveTemplate(input) {
    const values = [input.id, input.name, input.status, input.template, input.mapping || {}, input.metadata || {}];
    const sql = `INSERT INTO pdf_templates_deferred(id,name,status,template_json,mapping_json,metadata_json)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,status=EXCLUDED.status,
      template_json=EXCLUDED.template_json,mapping_json=EXCLUDED.mapping_json,metadata_json=EXCLUDED.metadata_json,
      version=pdf_templates_deferred.version+1,updated_at=now() RETURNING *`;
    return templateFromRow((await this.pool.query(sql, values)).rows[0]);
  }
  async findJobByIdempotencyKey(key) {
    if (!key) return null;
    return jobFromRow((await this.pool.query("SELECT * FROM pdf_generation_jobs WHERE idempotency_key=$1", [key])).rows[0]);
  }
  async createJob(input) {
    const id = randomUUID();
    const values = [id, input.templateId, input.templateVersion, input.runAt, input.payload, input.filename, input.maxAttempts, input.idempotencyKey || null, input.requestedBy || null];
    const sql = `INSERT INTO pdf_generation_jobs(id,template_id,template_version,status,run_at,payload_json,filename,max_attempts,idempotency_key,requested_by)
      VALUES($1,$2,$3,'QUEUED',$4,$5,$6,$7,$8,$9) RETURNING *`;
    return jobFromRow((await this.pool.query(sql, values)).rows[0]);
  }
  async getJob(id, { internal = false } = {}) { return jobFromRow((await this.pool.query("SELECT * FROM pdf_generation_jobs WHERE id=$1", [id])).rows[0], internal); }
  async claimNextJob() {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(`SELECT * FROM pdf_generation_jobs WHERE status='QUEUED' AND run_at<=now()
        ORDER BY run_at FOR UPDATE SKIP LOCKED LIMIT 1`);
      if (!result.rows[0]) { await client.query("COMMIT"); return null; }
      const updated = await client.query("UPDATE pdf_generation_jobs SET status='RUNNING',attempts=attempts+1,updated_at=now() WHERE id=$1 RETURNING *", [result.rows[0].id]);
      await client.query("COMMIT");
      return jobFromRow(updated.rows[0], true);
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
  async completeJob(id, result) {
    const values = [id, result.resultPath, result.templateVersion, result.inputCount];
    return jobFromRow((await this.pool.query("UPDATE pdf_generation_jobs SET status='DONE',result_path=$2,template_version=$3,input_count=$4,error_message=NULL,updated_at=now() WHERE id=$1 RETURNING *", values)).rows[0]);
  }
  async failJob(id, errorMessage, retry) {
    return jobFromRow((await this.pool.query("UPDATE pdf_generation_jobs SET status=$2,error_message=$3,updated_at=now() WHERE id=$1 RETURNING *", [id, retry ? "QUEUED" : "FAILED", errorMessage])).rows[0]);
  }
  async getResultPath(id) { return (await this.pool.query("SELECT result_path FROM pdf_generation_jobs WHERE id=$1 AND status='DONE'", [id])).rows[0]?.result_path || null; }
}

export async function createStore(databaseUrl) {
  if (!databaseUrl) return new MemoryStore();
  const { Pool } = await import("pg");
  return new PostgresStore(new Pool({ connectionString: databaseUrl }));
}
