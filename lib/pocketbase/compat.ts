import PocketBase from "pocketbase";

export type RecordData = Record<string, any>;
export type DbResult<T = any> = { data: T | null; error: Error | null };

type Predicate = {
  field: string;
  operator: "eq" | "lte" | "is" | "ilike" | "in";
  value: unknown;
};

type Mutation =
  | { kind: "read" }
  | { kind: "insert"; payload: RecordData | RecordData[] }
  | { kind: "update"; payload: RecordData }
  | { kind: "delete" }
  | { kind: "upsert"; payload: RecordData; onConflict: string[] };

const expandForCollection: Record<string, string> = {
  applications: "job_id,cv_profile_id",
  application_kits: "application_id,cv_profile_id",
  follow_ups: "application_id,application_id.job_id",
  saved_searches: "cv_profile_id",
  coach_threads: "application_id,application_id.job_id,application_id.cv_profile_id",
  coach_messages: "thread_id",
  application_events: "application_id",
};

const relationAliases: Record<string, string> = {
  job_id: "job",
  cv_profile_id: "cv",
  application_id: "application",
  thread_id: "thread",
};

function asError(error: unknown) {
  if (error instanceof Error) return error;
  if (typeof error === "object" && error && "message" in error && typeof (error as { message: unknown }).message === "string") {
    return new Error((error as { message: string }).message);
  }
  return new Error("PocketBase request failed.");
}

function mappedField(collection: string, field: string) {
  if (field === "created_at") return "created";
  if (field === "updated_at") return "updated";
  // Profiles are keyed by an owned relation in PocketBase rather than sharing
  // the auth-record primary key used by the former backend.
  if (collection === "profiles" && field === "id") return "user_id";
  return field;
}

function literal(value: unknown): string {
  if (value === null || value === undefined) return '""';
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}

function normaliseRecord(record: RecordData): RecordData {
  const output: RecordData = { ...record };
  if (record.created) output.created_at = record.created;
  if (record.updated) output.updated_at = record.updated;
  if (record.expand && typeof record.expand === "object") {
    output.expand = Object.fromEntries(
      Object.entries(record.expand as Record<string, RecordData | RecordData[]>).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.map(normaliseRecord) : normaliseRecord(value),
      ]),
    );
    for (const [relation, alias] of Object.entries(relationAliases)) {
      const expanded = output.expand[relation];
      if (expanded) output[alias] = expanded;
    }
  }
  return output;
}

function normalisePayload(payload: RecordData): RecordData {
  const {
    id: _id,
    created: _created,
    updated: _updated,
    created_at: _createdAt,
    updated_at: _updatedAt,
    collectionId: _collectionId,
    collectionName: _collectionName,
    expand: _expand,
    ...data
  } = payload;
  // Keep null values intact: PocketBase can distinguish clearing an optional
  // relation/value from writing the string "" or JSON string "null".
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

export class PocketBaseQuery implements PromiseLike<DbResult<any>> {
  private predicates: Predicate[] = [];
  private sort?: string;
  private selected = "*";
  private rowLimit?: number;
  private mutation: Mutation = { kind: "read" };

  constructor(private readonly db: PocketBaseDb, private readonly collection: string) {}

  select(fields = "*") {
    this.selected = fields;
    return this;
  }

  eq(field: string, value: unknown) {
    this.predicates.push({ field, operator: "eq", value });
    return this;
  }

  lte(field: string, value: unknown) {
    this.predicates.push({ field, operator: "lte", value });
    return this;
  }

  is(field: string, value: unknown) {
    this.predicates.push({ field, operator: "is", value });
    return this;
  }

  ilike(field: string, value: unknown) {
    this.predicates.push({ field, operator: "ilike", value });
    return this;
  }

  in(field: string, values: unknown[]) {
    this.predicates.push({ field, operator: "in", value: values });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.sort = `${options?.ascending === false ? "-" : ""}${mappedField(this.collection, field)}`;
    return this;
  }

  limit(value: number) {
    this.rowLimit = value;
    return this;
  }

  insert(payload: RecordData | RecordData[]) {
    this.mutation = { kind: "insert", payload };
    return this;
  }

  update(payload: RecordData) {
    this.mutation = { kind: "update", payload };
    return this;
  }

  delete() {
    this.mutation = { kind: "delete" };
    return this;
  }

  upsert(payload: RecordData, options: { onConflict: string }) {
    this.mutation = { kind: "upsert", payload, onConflict: options.onConflict.split(",").map((field) => field.trim()) };
    return this;
  }

  single(): Promise<DbResult<any>> {
    return this.execute(true, false);
  }

  maybeSingle(): Promise<DbResult<any>> {
    return this.execute(true, true);
  }

  then(
    onfulfilled?: ((value: any) => any) | null,
    onrejected?: ((reason: unknown) => any) | null,
  ): PromiseLike<any> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private filter() {
    return this.predicates.map((predicate) => {
      const field = mappedField(this.collection, predicate.field);
      if (predicate.operator === "in") {
        const values = Array.isArray(predicate.value) ? predicate.value : [];
        return `(${values.map((value) => `${field} = ${literal(value)}`).join(" || ") || "false"})`;
      }
      const operator = predicate.operator === "lte" ? "<=" : predicate.operator === "ilike" ? "~" : "=";
      return `${field} ${operator} ${literal(predicate.value)}`;
    }).join(" && ");
  }

  private async records() {
    const raw = await this.db.raw.collection(this.collection).getFullList<RecordData>({
      filter: this.filter() || undefined,
      sort: this.sort,
      expand: expandForCollection[this.collection],
    });
    let records = raw.map(normaliseRecord);
    if (this.rowLimit !== undefined) records = records.slice(0, this.rowLimit);
    if (this.selected.includes("kit:application_kits") && this.collection === "applications" && records.length) {
      const filter = records.map((record) => `application_id = ${literal(record.id)}`).join(" || ");
      const kits = await this.db.raw.collection("application_kits").getFullList<RecordData>({ filter });
      const byApplication = new Map(kits.map((kit) => [kit.application_id, normaliseRecord(kit)]));
      records = records.map((record) => ({ ...record, kit: byApplication.get(record.id) || null }));
    }
    return records;
  }

  private async execute(single = false, maybeSingle = false): Promise<DbResult<any>> {
    try {
      let records: RecordData[];
      const mutation = this.mutation;
      if (mutation.kind === "read") {
        records = await this.records();
      } else if (mutation.kind === "insert") {
        const payloads = Array.isArray(mutation.payload) ? mutation.payload : [mutation.payload];
        records = await Promise.all(payloads.map(async (payload) => normaliseRecord(await this.db.raw.collection(this.collection).create(normalisePayload(payload)) as RecordData)));
      } else if (mutation.kind === "upsert") {
        const conditions = mutation.onConflict.map((field) => ({ field, operator: "eq" as const, value: mutation.payload[field] }));
        const currentPredicates = this.predicates;
        this.predicates = [...currentPredicates, ...conditions];
        const existing = await this.records();
        this.predicates = currentPredicates;
        if (existing[0]) {
          records = [normaliseRecord(await this.db.raw.collection(this.collection).update(existing[0].id, normalisePayload(mutation.payload)) as RecordData)];
        } else {
          records = [normaliseRecord(await this.db.raw.collection(this.collection).create(normalisePayload(mutation.payload)) as RecordData)];
        }
      } else {
        const existing = await this.records();
        if (mutation.kind === "update") {
          records = await Promise.all(existing.map(async (record) => normaliseRecord(await this.db.raw.collection(this.collection).update(record.id, normalisePayload(mutation.payload)) as RecordData)));
        } else {
          await Promise.all(existing.map((record) => this.db.raw.collection(this.collection).delete(record.id)));
          records = [];
        }
      }

      if (single) {
        const record = records[0] || null;
        if (!record && !maybeSingle) return { data: null, error: new Error("Record not found.") };
        return { data: record, error: null };
      }
      return { data: records, error: null };
    } catch (error) {
      return { data: null, error: asError(error) };
    }
  }
}

export class PocketBaseDb {
  readonly auth: { getUser: () => Promise<{ data: { user: RecordData | null }; error: Error | null }> };

  constructor(readonly raw: PocketBase, readonly user: RecordData | null = null) {
    this.auth = {
      getUser: async () => ({
        data: { user: this.user },
        error: this.user ? null : new Error("Authentication required"),
      }),
    };
  }

  from(collection: string) {
    return new PocketBaseQuery(this, collection);
  }
}

export function pocketBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_POCKETBASE_URL?.trim();
  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("PocketBase is not configured. In Netlify, set NEXT_PUBLIC_POCKETBASE_URL to your public HTTPS PocketBase URL and redeploy.");
    }
    return "http://127.0.0.1:8090";
  }

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("NEXT_PUBLIC_POCKETBASE_URL is not a valid URL. Use your public HTTPS PocketBase URL in Netlify and redeploy.");
  }
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (process.env.NODE_ENV === "production" && (url.protocol !== "https:" || localHost)) {
    throw new Error("Netlify needs a public HTTPS PocketBase URL. localhost and 127.0.0.1 only work on your own computer.");
  }
  return url.toString().replace(/\/$/, "");
}

export function pocketBaseConnectionMessage(error: unknown) {
  const details = error as { message?: unknown; status?: unknown; originalError?: unknown };
  const message = typeof details?.message === "string" ? details.message : "";
  if (/PocketBase is not configured|NEXT_PUBLIC_POCKETBASE_URL|Netlify needs a public HTTPS/i.test(message)) return message;
  const original = details?.originalError instanceof Error ? details.originalError.message : "";
  if (details?.status === 0 || /fetch failed|network|connection|ECONNREFUSED/i.test(`${message} ${original}`)) {
    return "Could not reach PocketBase. Check NEXT_PUBLIC_POCKETBASE_URL in Netlify, confirm the PocketBase service is online, and allow your Netlify site in PocketBase CORS settings.";
  }
  return null;
}

export function createRawClient(token?: string) {
  const url = pocketBaseUrl();
  const pb = new PocketBase(url);
  pb.autoCancellation(false);
  if (token) pb.authStore.save(token);
  return pb;
}

export function normalisePbRecord(record: RecordData) {
  return normaliseRecord(record);
}
