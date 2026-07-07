export const TRAINING_MEDIA_TYPES = {
  photo: "treinamento_foto",
  file: "treinamento_arquivo"
} as const;

export type TrainingMediaType = (typeof TRAINING_MEDIA_TYPES)[keyof typeof TRAINING_MEDIA_TYPES];

export const TRAINING_PHOTO_DONE_COMMANDS = new Set(["ok", "pronto", "concluir", "fim"]);

export function trainingTemaPromptText(): string {
  return "🎓 Passo 1/5 — Qual o tema do treinamento?";
}

export function trainingParticipantsPromptText(): string {
  return "🎓 Passo 2/5 — Quem participou? Envie os nomes e CPFs.";
}

export function trainingDatesPromptText(): string {
  return "🎓 Passo 3/5 — Qual foi a data e horario?\n\nFormato: DD/MM/AAAA HH:mm - DD/MM/AAAA HH:mm";
}

export function trainingPhotoPromptText(): string {
  return "🎓 Passo 4/5 — 📸 Envie as fotos do treinamento.\n\nQuando terminar, digite OK.";
}

export function trainingFilePromptText(): string {
  return "🎓 Passo 5/5 — 📄 Envie a lista de presença em PDF ou foto.";
}

