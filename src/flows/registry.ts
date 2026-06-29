import { DiarioDasObrasFlow } from "./DiarioDasObras";
import { DIARIO_DAS_OBRAS_FLOW_KEY } from "./DiarioDasObras/types";
import type { ConversationServiceDeps, FlowDefinition } from "./types";

export const DEFAULT_FLOW_KEY = DIARIO_DAS_OBRAS_FLOW_KEY;

export interface FlowRegistry {
  defaultFlow: FlowDefinition;
  get(flowKey: string | null | undefined): FlowDefinition | null;
}

export function createFlowRegistry(deps: ConversationServiceDeps): FlowRegistry {
  const diarioDasObrasFlow = new DiarioDasObrasFlow(deps);
  const flows = new Map<string, FlowDefinition>([[diarioDasObrasFlow.key, diarioDasObrasFlow]]);

  return {
    defaultFlow: diarioDasObrasFlow,
    get(flowKey) {
      if (!flowKey) {
        return null;
      }

      return flows.get(flowKey) ?? null;
    }
  };
}
