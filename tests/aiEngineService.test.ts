import { describe, expect, it } from "vitest";
import { AiEngineService } from "../src/services/aiEngineService";

function createService(): AiEngineService {
  // Sem OPENAI_API_KEY configurada no ambiente de teste → usa fallback local.
  return new AiEngineService({
    nodeEnv: "test",
    openaiApiKey: undefined,
    openaiModel: "gpt-4o-mini",
    openaiVisionModel: "gpt-4o-mini",
    openaiEmbeddingModel: "text-embedding-3-small",
  } as never);
}

describe("AiEngineService (fallback local)", () => {
  it("is not configured when no API key is present", () => {
    const service = createService();
    expect(service.isConfigured).toBe(false);
  });

  it("analyzes evidence and infers a Switch category", async () => {
    const service = createService();
    const result = await service.analyzeEvidence({
      filename: "rack-switch.jpg",
      contentType: "image/jpeg",
      observation: "Painel com rack principal e switch Cisco 2960",
      existingOcrText: "Switch Cisco 2960\nIP 192.168.1.10",
    });

    expect(result.category).toBe("Switch");
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.aiDescription.length).toBeGreaterThan(10);
    expect(result.equipmentIdentified).toContain("Switch de rede");
  });

  it("detects anomalies and suggests pending issues", async () => {
    const service = createService();
    const result = await service.analyzeEvidence({
      observation: "Não foi identificado sinal HDMI no painel",
      filename: "painel-hdmi.jpg",
    });

    expect(result.hasAnomaly).toBe(true);
    expect(result.suggestedPendingIssues.length).toBeGreaterThan(0);
  });

  it("generates a full technical report with Bykonz structure", async () => {
    const service = createService();
    const result = await service.generateReport({
      reportCode: "RT-2026-000154",
      clientName: "Petrobras",
      vesselName: "SUB XII",
      serviceType: "Manutenção",
      attendanceType: "MAINTENANCE",
      siteLocation: "Porto do Rio",
      technicianName: "João Técnico",
      objective: "Inspeção do sistema de telemetria",
      evidences: [
        {
          category: "Switch",
          aiDescription: "Switch industrial Moxa identificado no rack.",
        },
        {
          category: "IPC",
          aiDescription: "IPC Siemens IoT2050 inspecionado.",
        },
      ],
      equipment: [{ name: "Switch Moxa", manufacturer: "Moxa" }],
      pendingIssues: [{ system: "Supervisório", description: "Validar splitter HDMI." }],
    });

    expect(result.content).toContain(RT_REPORT_CODE);
    expect(result.content).toContain("## Dados Gerais");
    expect(result.content).toContain("## Dados da Embarcação");
    expect(result.content).toContain("## Conclusão Técnica");
    expect(result.summary.length).toBeGreaterThan(10);
    expect(result.conclusion.length).toBeGreaterThan(10);
  });
});

const RT_REPORT_CODE = "RT-2026-000154";
