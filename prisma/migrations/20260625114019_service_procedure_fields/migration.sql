-- Add service type and procedure number fields to entry creation flow.
ALTER TYPE "ConversationStep" ADD VALUE 'AWAITING_SERVICE_TYPE';
ALTER TYPE "ConversationStep" ADD VALUE 'AWAITING_PROCEDURE_NUMBER';

ALTER TABLE "Entrada"
  ADD COLUMN "TipoServico" TEXT,
  ADD COLUMN "NumeroProcedimento" TEXT;

ALTER TABLE "WhatsappConversationState"
  ADD COLUMN "SelectedTipoServico" TEXT,
  ADD COLUMN "SelectedNumeroProcedimento" TEXT;
