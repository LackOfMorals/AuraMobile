import { AuraApiError, AuraAuthError, AuraClient, AuraUnreachableError, retryAfterMs } from "./client";

type Reply = { status: number; body?: unknown; headers?: Record<string, string> } | "network-error";

function setup(replies: Reply[], over: Partial<ConstructorParameters<typeof AuraClient>[0]> = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const queue = [...replies];
  const sleeps: number[] = [];
  let clock = 1_000_000;
  const fetchImpl = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = queue.shift();
    if (!next) throw new Error(`unexpected request: ${init.method} ${url}`);
    if (next === "network-error") throw new TypeError("Network request failed");
    return new Response(next.body === undefined ? null : JSON.stringify(next.body), { status: next.status, headers: next.headers });
  });
  const client = new AuraClient({
    baseUrl: "https://api.test",
    credentials: async () => ({ clientId: "id", clientSecret: "secret" }),
    fetch: fetchImpl as unknown as typeof fetch,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    now: () => clock,
    ...over,
  });
  return { client, calls, sleeps, advance: (ms: number) => (clock += ms) };
}

const token = (expires_in = 3600): Reply => ({ status: 200, body: { access_token: "tok", expires_in } });

describe("user agent", () => {
  const header = (call: { init: RequestInit }, name: string) => (call.init.headers as Record<string, string>)[name];

  it("is sent on the token request and on every API request, next to the headers each already has", async () => {
    const { client, calls } = setup([token(), { status: 200, body: { data: [] } }, { status: 202, body: {} }], { userAgent: "AuraMobile/9.9.9" });
    await client.listTenants();
    await client.updateInstance("i", { name: "x" });
    expect(calls).toHaveLength(3);
    for (const call of calls) expect(header(call, "User-Agent")).toBe("AuraMobile/9.9.9");
    expect(header(calls[0]!, "Authorization")).toMatch(/^Basic /);
    expect(header(calls[1]!, "Authorization")).toBe("Bearer tok");
    expect(header(calls[2]!, "Content-Type")).toBe("application/json");
  });

  it("is sent again on a retry after a rate limit", async () => {
    const { client, calls } = setup([token(), { status: 429, headers: { "retry-after": "1" } }, { status: 200, body: { data: [] } }], { userAgent: "AuraMobile/9.9.9" });
    await client.listTenants();
    expect(calls.every((c) => header(c, "User-Agent") === "AuraMobile/9.9.9")).toBe(true);
  });

  it("is left out when none is configured, as before", async () => {
    const { client, calls } = setup([token(), { status: 200, body: { data: [] } }]);
    await client.listTenants();
    expect(header(calls[0]!, "User-Agent")).toBeUndefined();
  });
});

describe("token", () => {
  it("is fetched with basic auth and sent as a bearer token", async () => {
    const { client, calls } = setup([token(), { status: 200, body: { data: [] } }]);
    await client.listTenants();
    expect(calls[0]!.url).toBe("https://api.test/oauth/token");
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe(`Basic ${btoa("id:secret")}`);
    expect(calls[0]!.init.body).toBe("grant_type=client_credentials");
    expect((calls[1]!.init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(calls[1]!.url).toBe("https://api.test/v1/tenants");
  });

  it("is reused until it is about to expire, then renewed", async () => {
    const { client, calls, advance } = setup([token(3600), { status: 200, body: { data: [] } }, { status: 200, body: { data: [] } }, token(), { status: 200, body: { data: [] } }]);
    await client.listTenants();
    await client.listTenants();
    expect(calls.filter((c) => c.url.endsWith("/oauth/token"))).toHaveLength(1);
    advance(3600 * 1000 - 30_000);
    await client.listTenants();
    expect(calls.filter((c) => c.url.endsWith("/oauth/token"))).toHaveLength(2);
  });

  it("is fetched once when requests start together", async () => {
    const { client, calls } = setup([token(), { status: 200, body: { data: [] } }, { status: 200, body: { data: [] } }]);
    await Promise.all([client.listTenants(), client.listInstances()]);
    expect(calls.filter((c) => c.url.endsWith("/oauth/token"))).toHaveLength(1);
  });

  it("rejects wrong credentials as an auth error", async () => {
    const { client } = setup([{ status: 401, body: {} }]);
    await expect(client.checkCredentials()).rejects.toBeInstanceOf(AuraAuthError);
  });

  it("is renewed once after a 401 on a request, and the request retried", async () => {
    const { client } = setup([token(), { status: 401 }, token(), { status: 200, body: { data: [{ id: "t", name: "T" }] } }]);
    expect(await client.listTenants()).toEqual([{ id: "t", name: "T" }]);
  });

  it("gives up if a fresh token is refused too", async () => {
    const { client } = setup([token(), { status: 401 }, token(), { status: 401, body: { errors: [{ message: "nope" }] } }]);
    await expect(client.listTenants()).rejects.toMatchObject({ status: 401 });
  });
});

describe("rate limits", () => {
  it("waits as Retry-After says, then retries", async () => {
    const { client, sleeps } = setup([token(), { status: 429, headers: { "retry-after": "3" } }, { status: 200, body: { data: [] } }]);
    await client.listTenants();
    expect(sleeps).toEqual([3000]);
    expect(client.stats.rateLimited).toBe(1);
  });

  it("makes later requests wait too, not just the one refused", async () => {
    const { client, sleeps } = setup([token(), { status: 429, headers: { "retry-after": "2" } }, { status: 200, body: { data: [] } }, { status: 200, body: { data: [] } }]);
    await client.listTenants();
    sleeps.length = 0;
    await client.listInstances();
    expect(sleeps).toEqual([]); // the pause was already served
  });

  it("refuses to wait longer than the limit", async () => {
    const { client } = setup([token(), { status: 429, headers: { "retry-after": "600" } }]);
    await expect(client.listTenants()).rejects.toMatchObject({ status: 429, problems: [{ reason: "rate-limit-exceeded" }] });
  });

  it("stops after the retries are used up", async () => {
    const replies: Reply[] = [token(), ...Array.from({ length: 3 }, (): Reply => ({ status: 429, headers: { "retry-after": "1" } }))];
    const { client } = setup(replies, { maxRetries: 2 });
    await expect(client.listTenants()).rejects.toMatchObject({ status: 429 });
  });

  it("reads Retry-After as seconds or as a date", () => {
    expect(retryAfterMs(new Response(null, { headers: { "retry-after": "5" } }), 0)).toBe(5000);
    expect(retryAfterMs(new Response(null, { headers: { "retry-after": new Date(10_000).toUTCString() } }), 0)).toBe(10_000);
    expect(retryAfterMs(new Response(null), 0)).toBeUndefined();
  });
});

describe("server errors", () => {
  it("retries a read after a 5xx", async () => {
    const { client, calls } = setup([token(), { status: 503 }, { status: 200, body: { data: [] } }]);
    await client.listTenants();
    expect(calls.filter((c) => c.url.endsWith("/tenants"))).toHaveLength(2);
  });

  it.each([
    ["create", (c: AuraClient) => c.createInstance({ version: "5", region: "r", memory: "4GB", name: "n", type: "professional-db", tenant_id: "t", cloud_provider: "gcp" })],
    ["delete", (c: AuraClient) => c.deleteInstance("i")],
    ["update", (c: AuraClient) => c.updateInstance("i", { name: "x" })],
    ["pause", (c: AuraClient) => c.pauseInstance("i")],
  ])("does not retry a %s after a 5xx, because it may have happened", async (_name, run) => {
    const { client, calls } = setup([token(), { status: 502, body: { errors: [{ message: "bad gateway" }] } }]);
    await expect(run(client)).rejects.toMatchObject({ status: 502 });
    expect(calls).toHaveLength(2);
  });

  it("keeps extra detail from an error entry, and from an error body of an unknown shape", async () => {
    const entry = setup([token(), { status: 400, body: { errors: [{ message: "request body contains validation errors", reason: "invalid", field: "storage", expected: ["16GB"] }] } }]);
    const e1 = await entry.client.deleteInstance("i").catch((e) => e);
    expect(e1.problems[0]).toMatchObject({ field: "storage", reason: "invalid", detail: '{"expected":["16GB"]}' });
    const odd = setup([token(), { status: 400, body: { title: "Bad request", violations: [{ path: "memory" }] } }]);
    const e2 = await odd.client.deleteInstance("i").catch((e) => e);
    expect(e2.problems[0].detail).toContain("violations");
  });

  it("reads Aura's own error message", async () => {
    const { client } = setup([token(), { status: 409, body: { errors: [{ message: "Instance is busy", reason: "conflict", field: "id" }] } }]);
    const error = await client.deleteInstance("i").catch((e) => e);
    expect(error).toBeInstanceOf(AuraApiError);
    expect(error.problems).toEqual([{ message: "Instance is busy", reason: "conflict", field: "id" }]);
  });
});

describe("a lost connection", () => {
  it("is reported without leaking the underlying error", async () => {
    const { client } = setup([token(), "network-error"]);
    const error = await client.listTenants().catch((e) => e);
    expect(error).toBeInstanceOf(AuraUnreachableError);
    expect(error.message).toBe("Could not reach Aura");
  });
});

describe("requests", () => {
  it("builds the instance paths and bodies", async () => {
    const { client, calls } = setup([
      token(),
      { status: 200, body: { data: [] } },
      { status: 202, body: {} },
      { status: 202, body: { data: { id: "i", status: "pausing" } } },
      { status: 202, body: { data: { id: "i", status: "resuming" } } },
    ]);
    await client.listInstances("a b");
    const update = await client.updateInstance("i/1", { memory: "8GB", storage: "32GB" });
    await client.pauseInstance("i");
    await client.resumeInstance("i");
    const [, list, patch, pause, resume] = calls;
    expect(list!.url).toBe("https://api.test/v1/instances?tenantId=a%20b");
    expect(patch!.url).toBe("https://api.test/v1/instances/i%2F1");
    expect(patch!.init).toMatchObject({ method: "PATCH", body: JSON.stringify({ memory: "8GB", storage: "32GB" }) });
    expect(update).toEqual({ status: 202, instance: undefined });
    expect(pause!.url).toBe("https://api.test/v1/instances/i/pause");
    expect(resume!.url).toBe("https://api.test/v1/instances/i/resume");
  });
});
