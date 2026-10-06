import { describe, expect, it } from "vitest";

describe("PicPay webhook data minimization", () => {
  it("persists only metadata and a payload hash", () => {
    const persisted = ["event_id", "status", "merchant_charge_id", "payload_hash", "received_at"];
    expect(persisted).not.toContain("payload");
    expect(persisted).toContain("payload_hash");
  });
});
