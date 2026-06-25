-- Add dedicated training flow persistence.
ALTER TYPE "ConversationStep" ADD VALUE 'SELECT_EMPRESA_FOR_TRAINING';
ALTER TYPE "ConversationStep" ADD VALUE 'AWAITING_TRAINING_TEMA';
ALTER TYPE "ConversationStep" ADD VALUE 'AWAITING_TRAINING_PARTICIPANTS';
ALTER TYPE "ConversationStep" ADD VALUE 'AWAITING_TRAINING_DATES';
ALTER TYPE "ConversationStep" ADD VALUE 'AWAITING_TRAINING_PHOTO';
ALTER TYPE "ConversationStep" ADD VALUE 'AWAITING_TRAINING_FILE';

ALTER TABLE "_EntradaMedia"
  ADD COLUMN "MediaTipo" TEXT;

CREATE TABLE "Treinamento" (
  "id" SERIAL NOT NULL,
  "Entrada_id" BIGINT NOT NULL,
  "Tema" TEXT NOT NULL,
  "Participantes" TEXT,
  "Inicio" TIMESTAMPTZ(6) NOT NULL,
  "Fim" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "Treinamento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Treinamento_Entrada_id_key" ON "Treinamento"("Entrada_id");

ALTER TABLE "Treinamento"
  ADD CONSTRAINT "Treinamento_Entrada_id_fkey"
  FOREIGN KEY ("Entrada_id") REFERENCES "Entrada"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WhatsappConversationState"
  ADD COLUMN "SelectedTreinamentoTema" TEXT,
  ADD COLUMN "SelectedTreinamentoParticipantes" TEXT,
  ADD COLUMN "SelectedTreinamentoInicio" TIMESTAMPTZ(6),
  ADD COLUMN "SelectedTreinamentoFim" TIMESTAMPTZ(6),
  ADD COLUMN "SelectedTrainingPhotoCount" INTEGER;
