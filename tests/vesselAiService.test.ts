import { describe, expect, it } from "vitest";
import { analyzeEvidenceContent } from "../src/services/vesselAiService";

describe("analyzeEvidenceContent", () => {
  it("detects network equipment and suggests a technical category", () => {
    const result = analyzeEvidenceContent({
      filename: "rack-switch.jpg",
      contentType: "image/jpeg",
      observation: "Painel com rack principal e switch Cisco 2960",
      ocrText: "Switch Cisco 2960\nIP 192.168.1.10\nSN ABC123"
    });

    expect(result.category).toContain("Rede");
    expect(result.aiTags).toContain("switch");
    expect(result.aiSummary).toMatch(/switch|ip|rack/i);
    expect(result.suggestedActions).toEqual(expect.arrayContaining([expect.stringMatching(/test/i)]));
  });
});
