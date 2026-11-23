import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
// Inspeção de contrato SQL, NÃO testes de RLS/transações contra PostgreSQL.
const sql = readFileSync("docs/proposals/0022_card_present.sql", "utf8");
describe("Unapplied additive card SQL proposal", () => {
  it("has sequential proposal number without managed migration or journal promotion", () => {
    expect(existsSync("drizzle/migrations/0022_card_present.sql")).toBe(false);
    expect(readFileSync("drizzle/migrations/meta/_journal.json", "utf8")).not.toContain("0022");
  });
  it("gives legacy and new omitted-method charges the constant PIX default", () =>
    expect(sql).toMatch(/add column if not exists payment_method text not null default 'PIX'/));
  it("does not contain destructive commands, cron scheduling or backfill", () => {
    expect(sql).not.toMatch(/\b(drop|delete|truncate)\b/i);
    expect(sql).not.toMatch(
      /cron\.schedule|alter\s+column|update\s+public\.charges\s+set\s+payment_method/i,
    );
  });
  it("grants every new public table before enabling RLS", () => {
    for (const table of [
      "card_present_sessions",
      "card_present_requests",
      "card_present_rate_buckets",
      "card_present_events",
    ]) {
      const create = sql.indexOf(`create table if not exists public.${table}`);
      const grant = sql.indexOf(`grant all on public.${table} to service_role`);
      const rls = sql.indexOf(`alter table public.${table} enable row level security`);
      expect(create).toBeGreaterThan(-1);
      expect(grant).toBeGreaterThan(create);
      expect(rls).toBeGreaterThan(grant);
    }
  });
  it("owner reads are account-scoped and clients receive no writes to the queue or sessions", () => {
    expect(sql).toContain("a.id=card_present_sessions.account_id and a.owner_id=auth.uid()");
    expect(sql).toContain("grant select on public.card_present_sessions to authenticated");
    expect(sql).not.toMatch(/grant (insert|update|delete|all).*to authenticated/i);
  });
  it("prevents cross-account or inconsistent charge/integration relations with composite FKs", () => {
    expect(sql).toContain("foreign key(charge_id,account_id,payment_integration_id,amount_cents)");
    expect(sql).toContain("foreign key(payment_integration_id,account_id)");
    expect(sql).toContain("c.payment_method='CARD_NFC' and c.amount_cents=new.amount_cents");
  });
  it("reserves requests and external references atomically rather than using a process-local cache", () => {
    expect(sql).toContain("where id=p_account_id for update");
    expect(sql).toContain("primary key(account_id,actor_id,idempotency_key)");
    expect(sql).toContain("unique(account_id,external_reference)");
    expect(sql).toContain("v_request.request_hash<>p_hash");
  });
  it("queue minimizes data, uses replay uniqueness, bounded leases and fenced completion", () => {
    const table = sql.slice(
      sql.indexOf("create table if not exists public.card_present_events"),
      sql.indexOf("grant all on public.card_present_events"),
    );
    expect(table).not.toMatch(/\bjsonb?\b|\bpan\b|\bcvv\b|card_number|payer/i);
    expect(table).toContain("unique(payment_integration_id,event_id)");
    expect(sql).toContain("limit 20 for update skip locked");
    expect(sql).toContain("lease_id=p_lease");
    expect(sql).toContain("lease_until>=now()");
    expect(sql).toContain("attempts<5");
    expect(sql).toContain("v_hits<=10");
  });
  it("MOCK is restricted to inactive Mercado Pago sandbox and never marks PAID", () => {
    expect(sql).toContain(
      "pi.provider='MERCADOPAGO' and pi.environment='SANDBOX' and pi.status='INACTIVE'",
    );
    expect(sql).not.toMatch(/set status='PAID'|then 'PAID'/);
    expect(sql).toContain("and payment_method='CARD_NFC'");
  });
});
// Não inventar sucesso de isolamento, concorrência ou aplicação do schema.
describe.skip("Card PostgreSQL integration — requires explicit schema authorization", () => {
  it.todo("legacy/new omitted-method rows read PIX after additive migration");
  it.todo("authenticated owner sees only its sessions and cannot write queue/session rows");
  it.todo("cross-account charge/integration insert and reverse parent reassignment fail");
  it.todo("concurrent identical requests create exactly one charge/session/reservation");
  it.todo("duplicate signed events enqueue once and expired leases can be retried");
  it.todo("concurrent rate consumption allows only ten requests per minute");
});
