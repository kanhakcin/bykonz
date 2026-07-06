import { describe, expect, it } from "vitest";
import { extractCodeMentions, type CodePrefixLookup } from "../src/services/mentionParser";

function prefixMap(entries: Record<string, CodePrefixLookup["entityType"]>): Map<string, CodePrefixLookup> {
  return new Map(Object.entries(entries).map(([prefix, entityType]) => [prefix, { entityType }]));
}

describe("extractCodeMentions", () => {
  it("extracts a single standard code", () => {
    const result = extractCodeMentions(
      "Grauteamento da canaleta (PS-024)",
      prefixMap({ PS: "STANDARD" })
    );

    expect(result).toEqual([
      { code: "PS-024", prefix: "PS", entityType: "STANDARD", matchedText: "(PS-024)" }
    ]);
  });

  it("extracts multiple distinct codes with different entity types", () => {
    const result = extractCodeMentions(
      "José operando a misturadora (MX-007) conforme (PS-024)",
      prefixMap({ PS: "STANDARD", MX: "MACHINE" })
    );

    expect(result).toEqual([
      { code: "MX-007", prefix: "MX", entityType: "MACHINE", matchedText: "(MX-007)" },
      { code: "PS-024", prefix: "PS", entityType: "STANDARD", matchedText: "(PS-024)" }
    ]);
  });

  it("ignores unknown prefixes", () => {
    const result = extractCodeMentions("Referência (XX-999)", prefixMap({ PS: "STANDARD" }));
    expect(result).toEqual([]);
  });

  it("extracts a bare code without parentheses (e.g. from a dedicated procedure-number field)", () => {
    const result = extractCodeMentions("PS-024", prefixMap({ PS: "STANDARD" }));
    expect(result).toEqual([
      { code: "PS-024", prefix: "PS", entityType: "STANDARD", matchedText: "PS-024" }
    ]);
  });

  it("does not match a code embedded inside a larger token", () => {
    const result = extractCodeMentions("XPS-0242 não é um código", prefixMap({ PS: "STANDARD" }));
    expect(result).toEqual([]);
  });

  it("deduplicates when the same code appears both bare and in parentheses", () => {
    const result = extractCodeMentions(
      "Procedimento PS-024 aplicado, conforme (PS-024)",
      prefixMap({ PS: "STANDARD" })
    );
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("PS-024");
  });

  it("is case-insensitive on the prefix", () => {
    const result = extractCodeMentions("Norma (ps-024)", prefixMap({ PS: "STANDARD" }));
    expect(result).toEqual([
      { code: "PS-024", prefix: "PS", entityType: "STANDARD", matchedText: "(ps-024)" }
    ]);
  });

  it("deduplicates repeated codes in the same text", () => {
    const result = extractCodeMentions(
      "Conforme (PS-024). Revisão da (PS-024) aplicada.",
      prefixMap({ PS: "STANDARD" })
    );

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("PS-024");
  });

  it("returns an empty array for empty text", () => {
    expect(extractCodeMentions("", prefixMap({ PS: "STANDARD" }))).toEqual([]);
  });
});
