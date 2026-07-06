# Manutenção e Gerenciamento de Traduções (i18n)

Este diretório contém um conjunto de ferramentas em Python para automatizar a manutenção, limpeza e sincronização dos arquivos de tradução (`pt.json`, `en.json`, `es.json`).

> **Base do Projeto**: O arquivo `pt.json` é considerado a **fonte da verdade**. Todas as sincronizações e deduplicações são baseadas nele.

---

## 🚀 Comandos Rápidos (pnpm)

Os principais scripts estão mapeados no `package.json`:

| Comando | Script Executado | Descrição |
| :--- | :--- | :--- |
| **`pnpm i18n`** | `i18n_pipeline.py` | **Pipeline Completo**: Executa Sort > Clean > Dedupe > Sync > Check. |
| `pnpm i18n:clean` | `i18n_remove_unused.py` | Remove chaves que não estão sendo usadas no código. |
| `pnpm i18n:dedupe` | `i18n_deduplicate.py` | Mescla chaves com valores duplicados no `pt.json` e atualiza o código. |
| `pnpm i18n:check` | `i18n_check_missing.py` | Identifica chaves usadas no código que faltam no `pt.json`. |
| `pnpm i18n:validate` | `i18n_validate.py` | Valida a integridade e consistência dos arquivos após alterações. |

---

## 📚 Scripts Detalhados

### 1. `i18n_pipeline.py` (O Maestro)
Executa todo o processo de manutenção em sequência para garantir que as traduções estejam limpas, ordenadas e sincronizadas.
- **Ordem**: Sort → Remove Unused → Deduplicate → Sync → Check Missing.

### 2. `i18n_sort.py`
Ordena as chaves nos arquivos JSON.
- **Lógica**: Primeiro por tamanho da chave (menores primeiro) e depois em ordem alfabética.
- **Arquivos afetados**: `pt.json`, `en.json`, `es.json`.

### 3. `i18n_remove_unused.py`
Varre o diretório `src/` em busca de usos de `t('chave')` ou `$t('chave')`.
- Remove do JSON qualquer chave que não foi encontrada em nenhum arquivo de código.

### 4. `i18n_deduplicate.py`
Identifica valores idênticos no `pt.json`.
- Mantém apenas a primeira chave encontrada para aquele valor.
- Substitui todas as chaves obsoletas no código pela chave "oficial".
- Gera `mapa_refatoracao.json` e `refactoring_log.txt`.

### 5. `i18n_sync.py`
Garante que `en.json` e `es.json` tenham exatamente as mesmas chaves que `pt.json`.
- **Remove**: Chaves que existem em EN/ES mas foram apagadas do PT.
- **Adiciona**: Chaves novas do PT para EN/ES (com valor inicial `"TODO"`).

### 6. `i18n_check_missing.py`
Busca no código por chaves de tradução que ainda não foram adicionadas ao `pt.json`.
- Gera o relatório: `Chaves de tradução faltando.txt`.
- **Nota**: Possui uma lista interna (`IGNORED_KEYS`) para ignorar termos técnicos (como `animate`, `normal`, `leaflet`) que não são chaves de tradução.

### 7. `i18n_validate.py`
Uma auditoria final para garantir:
- Que não sobraram duplicatas.
- Que as chaves removidas realmente sumiram.
- Que não há referências quebradas no código.

---

## 🛠️ Como usar individualmente

Todos os scripts (exceto o validation) aceitam a flag `--dry-run` para visualizar o que seria feito sem alterar nenhum arquivo:

```bash
# Exemplo de Dry Run
python3 src/config/translations/i18n_deduplicate.py --dry-run
```

## 📁 Arquivos de Tradução
- `pt.json`: Português (Fonte principal).
- `en.json`: Inglês (Sincronizado via script).
- `es.json`: Espanhol (Sincronizado via script).