export const TRAINING_MEDIA_TYPES = {
  photo: "treinamento_foto",
  file: "treinamento_arquivo"
} as const;

export type TrainingMediaType = (typeof TRAINING_MEDIA_TYPES)[keyof typeof TRAINING_MEDIA_TYPES];

export const TRAINING_PHOTO_DONE_COMMANDS = new Set(["ok", "pronto", "concluir", "fim"]);

export function trainingTemaPromptText(): string {
  return "Informe o tema do treinamento.";
}

export function trainingParticipantsPromptText(): string {
  return "Informe os nomes e CPFs dos participantes.";
}

export function trainingDatesPromptText(): string {
  return "Informe data e hora de inicio e fim no formato DD/MM/AAAA HH:mm - DD/MM/AAAA HH:mm.";
}

export function trainingPhotoPromptText(): string {
  return "Envie as fotos do treinamento. Quando terminar, digite OK.";
}

export function trainingFilePromptText(): string {
  return "Envie o arquivo do treinamento em PDF ou foto.";
}

