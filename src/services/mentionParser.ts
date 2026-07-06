/**
 * Pipeline de identificação — etapa [1], determinística.
 * docs/arquitetura-dados-nova-versao-v1.md §5: regex extrai códigos padronizados
 * (ex. "(PS-024)" na legenda livre, ou "PS-024" quando é o próprio conteúdo de
 * um campo dedicado como o número do procedimento), classifica pelo prefixo
 * via code_prefixes e resolve a entidade no setor do registro. Vínculos por
 * CODIGO entram confirmados (source "CODE", confirmed true).
 */

// Casa "(PS-024)" (uso em legenda livre) ou "PS-024" isolado por limite de
// palavra (uso em campos dedicados, ex. número do procedimento).
const CODE_PATTERN = /\(([A-Za-z]+)-?(\d+)\)|\b([A-Za-z]+)-(\d+)\b/g;

export type ParsedEntityType = "STANDARD" | "PERSON" | "MACHINE" | "ASSET";

export interface ParsedCodeMention {
  /** Código completo casado, ex. "PS-024" (prefixo normalizado + número). */
  code: string;
  /** Prefixo em maiúsculas, ex. "PS". */
  prefix: string;
  entityType: ParsedEntityType;
  /** Texto exatamente como apareceu na legenda, ex. "(PS-024)". */
  matchedText: string;
}

export interface CodePrefixLookup {
  entityType: ParsedEntityType;
}

/**
 * Extrai códigos entre parênteses do texto e classifica cada um pelo prefixo
 * usando o mapa de prefixos do setor (código global tem prioridade sobre o
 * prefixo específico do setor, refletindo `code_prefixes.sector_id` nullable).
 */
export function extractCodeMentions(
  text: string,
  prefixMap: Map<string, CodePrefixLookup>
): ParsedCodeMention[] {
  const mentions: ParsedCodeMention[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(CODE_PATTERN)) {
    const prefix = (match[1] ?? match[3]).toUpperCase();
    const number = match[2] ?? match[4];
    const lookup = prefixMap.get(prefix);
    if (!lookup) {
      continue;
    }

    const code = `${prefix}-${number}`;
    if (seen.has(code)) {
      continue;
    }
    seen.add(code);

    mentions.push({
      code,
      prefix,
      entityType: lookup.entityType,
      matchedText: match[0]
    });
  }

  return mentions;
}
