-- Add generic flow state for modular WhatsApp flows.
ALTER TABLE "WhatsappConversationState"
  ADD COLUMN "FlowKey" TEXT,
  ADD COLUMN "StepKey" TEXT,
  ADD COLUMN "FlowData" JSONB;
