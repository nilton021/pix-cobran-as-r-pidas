import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

const url = process.env["SUPABASE_DB_URL"];
describe.skipIf(!url)("Card PostgreSQL concurrent sandbox protections", () => {
  const db = postgres(url ?? "", { max: 12, connect_timeout: 10 });
  const account = randomUUID();
  const actor = randomUUID();
  let integration = "";
  let session = "";
  let providerSession = "";

  async function service<T>(operation: (tx: postgres.TransactionSql) => Promise<T>) {
    return db.begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.role','service_role',true), set_config('request.jwt.claims','{"role":"service_role"}',true)`;
      return operation(tx);
    });
  }

  beforeAll(async () => {
    const owners = await db<{ owner_id: string }[]>`select owner_id from public.accounts limit 1`;
    const owner = owners[0]?.owner_id;
    if (!owner) throw new Error("An existing account owner is required");
    await db`insert into public.accounts(id,owner_id,name,email,document)
      values(${account},${owner},'Teste concorrente temporário','card-concurrency@example.invalid','00000000000')`;
    const rows = await service((tx) => tx<{ id: string }[]>`select public.card_nfc_prepare_mock(${account},${owner}) as id`);
    const id = rows[0]?.id;
    if (!id) throw new Error("Sandbox fixture unavailable");
    integration = id;
  }, 30_000);

  afterAll(async () => {
    try {
      await db.begin(async (tx) => {
        await tx`delete from public.card_present_events where payment_integration_id in (select id from public.payment_integrations where account_id=${account})`;
        await tx`delete from public.card_present_requests where account_id=${account}`;
        await tx`delete from public.card_present_rate_buckets where account_id=${account}`;
        await tx`delete from public.card_present_sessions where account_id=${account}`;
        await tx`delete from public.charges where account_id=${account}`;
        await tx`delete from public.payment_integrations where account_id=${account}`;
        await tx`delete from public.accounts where id=${account}`;
      });
    } finally {
      await db.end({ timeout: 5 });
    }
  }, 30_000);

  it("twelve identical simultaneous requests create one charge, session and reservation", async () => {
    const results = await Promise.all(Array.from({ length: 12 }, async () => {
      const id = randomUUID();
      return service((tx) => tx<{ result: { session: { id: string; provider_session_id: string }; replay: boolean } }[]>`
        select public.card_nfc_create_session(${account},${actor},'concurrent',${"a".repeat(64)},${integration},1500,null,null,${id},${"mock_" + id}) as result`);
    }));
    const first = results[0]?.[0]?.result.session;
    if (!first) throw new Error("No session returned");
    session = first.id;
    providerSession = first.provider_session_id;
    expect(new Set(results.map((r) => r[0]?.result.session.id)).size).toBe(1);
    expect(results.filter((r) => r[0]?.result.replay === false)).toHaveLength(1);
    const counts = await db<{ charges: number; sessions: number; requests: number }[]>`
      select (select count(*)::int from public.charges where account_id=${account}) as charges,
      (select count(*)::int from public.card_present_sessions where account_id=${account}) as sessions,
      (select count(*)::int from public.card_present_requests where account_id=${account}) as requests`;
    expect(counts[0]).toEqual({ charges: 1, sessions: 1, requests: 1 });
  }, 30_000);

  it("twelve simultaneous duplicate events enqueue exactly once", async () => {
    expect(session).not.toBe("");
    const results = await Promise.all(Array.from({ length: 12 }, () => service((tx) =>
      tx<{ accepted: boolean }[]>`select public.card_nfc_enqueue_event('ConcurrentEvent',${integration},${providerSession},1500,'APPROVED',now(),${"b".repeat(64)}) as accepted`)));
    expect(results.filter((r) => r[0]?.accepted === true)).toHaveLength(1);
    const rows = await db<{ count: number }[]>`select count(*)::int as count from public.card_present_events where session_id=${session}`;
    expect(rows[0]?.count).toBe(1);
  }, 30_000);

  it("twenty simultaneous calls allow exactly ten in the same minute", async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => service((tx) =>
      tx<{ allowed: boolean; minute: string }[]>`select public.card_nfc_consume_limit(${account},${actor}) as allowed,date_trunc('minute',now())::text as minute`)));
    expect(new Set(results.map((r) => r[0]?.minute)).size).toBe(1);
    expect(results.filter((r) => r[0]?.allowed === true)).toHaveLength(10);
  }, 30_000);
});