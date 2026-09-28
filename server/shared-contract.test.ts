import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { evaluate } from "../src/engine/evaluate";
import { decodePlayDocument, encodePlayDocument } from "../src/shared/documents";
import { adminRoleRequestSchema, mutationRequestSchema, registerRequestSchema, registrationSettingsSchema } from "./protocol";

describe("server shared scoring contract", () => {
  it("evaluates the exact-decimal golden document unchanged in the Node build", async () => {
    const fixture = JSON.parse(
      await readFile(new URL("../golden/cases/exact-decimal-arithmetic.json", import.meta.url), "utf8"),
    ) as { input: unknown; expected: { players: Array<{ total: string | null }> } };
    const decoded = decodePlayDocument(fixture.input);
    expect(evaluate(decoded).players.map((player) => player.total?.toFixed() ?? null)).toEqual(
      fixture.expected.players.map((player) => player.total),
    );
    expect(evaluate(decodePlayDocument(encodePlayDocument(decoded)))).toEqual(evaluate(decoded));
  });

  it("validates mutation envelopes", () => {
    expect(() => mutationRequestSchema.parse({ context: {}, mutation: {} })).toThrow();
  });

  it("rejects privileged public registration fields and invalid administrative roles", () => {
    expect(() => registerRequestSchema.parse({ username: "valid-user", password: "long enough password", role: "admin" })).toThrow();
    expect(() => adminRoleRequestSchema.parse({ role: "owner" })).toThrow();
    expect(() => registrationSettingsSchema.parse({ enabled: true, defaultRole: "admin" })).toThrow();
  });
});
