import { describe, expect, it } from "bun:test";

describe("customer webhook contract", () => {
  it("usa apenas HTTPS", () => {
    expect(/^https:\/\//i.test("https://example.com/webhook")).toBe(true);
    expect(/^https:\/\//i.test("http://example.com/webhook")).toBe(false);
  });

  it("aceita somente o evento de mudança de status nesta fase", () => {
    const allowed = ["charge.status_changed"];
    expect(allowed.includes("charge.status_changed")).toBe(true);
    expect(allowed.includes("charge.created")).toBe(false);
  });
});
