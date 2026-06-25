import { describe, expect, it } from "vitest";
import { getWahaPhoneLookupCandidates, normalizePhoneFromChatId } from "../src/utils/phone";

describe("normalizePhoneFromChatId", () => {
  it("extracts the phone from a regular WAHA chat id", () => {
    expect(normalizePhoneFromChatId("5547996222708@c.us")).toBe("5547996222708");
  });

  it("ignores WAHA device suffixes before extracting digits", () => {
    expect(normalizePhoneFromChatId("5547996222708:12@c.us")).toBe("5547996222708");
  });

  it("ignores device suffixes on s.whatsapp.net JIDs", () => {
    expect(normalizePhoneFromChatId("554799720053:3@s.whatsapp.net")).toBe("554799720053");
  });
});

describe("getWahaPhoneLookupCandidates", () => {
  it("returns exact then shorter Brazilian mobile variant when the ninth digit is present", () => {
    expect(getWahaPhoneLookupCandidates("5511999999999")).toEqual([
      "5511999999999",
      "551199999999"
    ]);
  });

  it("returns exact then inserted-ninth Brazilian mobile variant when the ninth digit is absent", () => {
    expect(getWahaPhoneLookupCandidates("551199999999")).toEqual([
      "551199999999",
      "5511999999999"
    ]);
  });

  it("does not create Brazilian variants for non-Brazilian numbers", () => {
    expect(getWahaPhoneLookupCandidates("12125551212")).toEqual(["12125551212"]);
  });

  it("keeps the reported stored number with the ninth digit as the first candidate", () => {
    expect(getWahaPhoneLookupCandidates("5547996222708")[0]).toBe("5547996222708");
  });

  it("keeps the reported stored number without the ninth digit as the first candidate", () => {
    expect(getWahaPhoneLookupCandidates("554799720053")[0]).toBe("554799720053");
  });

  it("does not return duplicate candidates", () => {
    const candidates = getWahaPhoneLookupCandidates("5511999999999");

    expect(new Set(candidates).size).toBe(candidates.length);
  });
});
