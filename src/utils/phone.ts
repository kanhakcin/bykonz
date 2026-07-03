export function normalizePhoneFromChatId(chatId: string): string {
  return chatId.split("@")[0]?.split(":")[0]?.replace(/\D/g, "") ?? "";
}

export function extractPhoneFromWahaPayload(payload: {
  from?: string;
  chatId?: string;
  _data?: Record<string, unknown>;
}): string {
  const candidates = [
    readNestedString(payload, ["_data", "Info", "SenderAlt"]),
    readNestedString(payload, ["_data", "SenderAlt"]),
    readNestedString(payload, ["_data", "Info", "Sender"]),
    readNestedString(payload, ["_data", "Sender"]),
    payload.from,
    payload.chatId
  ];

  for (const candidate of candidates) {
    if (!candidate || isLidJid(candidate)) {
      continue;
    }

    const phoneDigits = normalizePhoneFromChatId(candidate);
    if (phoneDigits) {
      return phoneDigits;
    }
  }

  return "";
}

export function getWahaPhoneLookupCandidates(phoneDigits: string): string[] {
  const candidates = [phoneDigits];

  if (/^\d+$/.test(phoneDigits) && phoneDigits.startsWith("55")) {
    if (phoneDigits.length === 13 && phoneDigits[4] === "9") {
      candidates.push(`${phoneDigits.slice(0, 4)}${phoneDigits.slice(5)}`);
    } else if (phoneDigits.length === 12) {
      candidates.push(`${phoneDigits.slice(0, 4)}9${phoneDigits.slice(4)}`);
    }
  }

  return [...new Set(candidates)];
}

export function readNestedString(source: unknown, path: string[]): string | undefined {
  let current = source;

  for (const key of path) {
    if (!isRecord(current)) {
      return undefined;
    }

    current = current[key];
  }

  return typeof current === "string" && current.trim() ? current : undefined;
}

export function phoneDigitsToE164(phoneDigits: string): string | null {
  if (!/^\d+$/.test(phoneDigits)) {
    return null;
  }

  return `+${phoneDigits}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLidJid(value: string): boolean {
  return value.toLowerCase().includes("@lid");
}
