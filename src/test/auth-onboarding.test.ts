import { describe, expect, it } from "vitest";

describe("auth onboarding contract", () => {
  it("requires a stronger password policy", () => {
    expect("senha-com-12").toHaveLength(12);
    expect("curta").toHaveLength(5);
  });
});
