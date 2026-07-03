# Diário das Obras — Contexto do Projeto

> **Como usar:** anexe ou cole este arquivo no início de uma nova sessão para retomar o trabalho sem reexplicar o projeto. É um documento vivo — atualize conforme as decisões evoluírem.
> **Última atualização:** 26/06/2026 · **Cliente:** (construção civil) · **Responsável:** Tanen Tecnologia

---

## 1. Em uma frase

App de **diário de obra / vistorias** operado por **WhatsApp** (via WAHA): o engenheiro envia fotos com legenda, o sistema registra em banco, **vincula automaticamente** normas/pessoas/máquinas citadas e gera **relatórios + alertas** num **painel web do gestor**. A Tanen assumiu a continuidade do desenvolvimento; o código atual veio do desenvolvedor anterior.

---

## 2. Stack atual (as-is)

Backend Node.js (≥20) + **TypeScript** (`strict`), **Express** (1 webhook + healthcheck), **Prisma 6** sobre **PostgreSQL (Supabase)**, **Supabase Storage** via API S3 (`@aws-sdk/client-s3`), **WAHA** como gateway de WhatsApp, **PDFKit** para relatórios, **Vitest** para testes. Pacote: `whatsapp-management-backend` v0.1.0.

Arquitetura limpa: **Ports & Adapters** com injeção de dependência (`container.ts`); o núcleo (`conversationService.ts`) depende de interfaces, não de implementações. Boa cobertura de testes.

> **Importante:** o **Supabase é uma instância do desenvolvedor anterior** e **não** está cadastrada no Metabase Tanen. Não há credenciais nem acesso ao banco ao vivo neste ambiente — a estrutura conhecida vem do `schema.prisma` + migrations. Para inspecionar o banco real é preciso `pg_dump --schema-only`, connection string read-only ou acesso ao projeto Supabase.

---

## 3. O que o sistema faz hoje

Bot conversacional **1-a-1** (não captura de grupo) navegado por **menu numérico**: menu → categoria (7 fixas, incl. "Diário de obra") → **Incluir** ou **Consulta** → empresa → **foto** → **descrição** → "Registro salvo" → volta ao menu. Cada foto exige o ciclo completo. Consulta gera **PDF por empresa + dia único**, entregue no WhatsApp.

Tabelas atuais: `Usuarios`, `Empresa`, `_UserEmpresa`, `Entrada`, `_EntradaMedia`, `WhatsappConversationState`.

**Lacunas/riscos já mapeados:** divergência de escopo (é 1-a-1, não captura de grupo); 1 foto = 1 entrada; categorias hardcoded; sem cadastro/admin; **entrada órfã** (criada com descrição vazia ao receber a foto); **webhook sem autenticação nem idempotência**; `PhoneE164` como `BIGINT` em `Usuarios` mas `TEXT` no estado; estado de conversa sem expiração; fragilidade com o esquema **LID** do WhatsApp; relatório só de um dia; README desatualizado.

---

## 4. Objetivo da evolução (v1)

1. **Normas:** catálogo por setor; código entre parênteses na legenda (ex.: `(PS-024)`) vinculado automaticamente.
2. **Pessoas + treinamento:** cadastro com matrícula/status e **competência por norma**; alerta quando pessoa citada não é treinada para a atividade.
3. **Máquinas + vistorias:** controle com checklist e **validade**; alerta se a máquina citada não tem vistoria válida.
4. **Painel web do gestor** (frente nova — não existe hoje).
   - **v2:** QR Code por ativo (lê o QR → registros seguintes herdam o ativo).
   - **Transversal:** mesmo produto atende **construção civil e setor naval** (embarcações) — banco estruturado por setor.

---

## 5. Decisões travadas

- **Identificação na legenda → híbrida:** começa com **códigos padronizados** (regex + prefixo: PS→norma, MX→máquina, MAT→pessoa); **IA/LLM** entra depois para texto livre (nomes sem matrícula etc.). Toda menção guarda **origem** (CODIGO/IA/MANUAL/QR) e **confiança**. A camada de IA encaixa no stack **n8n + MCP** da Tanen.
- **Multi-setor → núcleo comum + extensões dirigidas por configuração** (não tabelas separadas por setor). `setor` é discriminador; hierarquia de ativos parametrizável; características específicas em **JSONB**. Adicionar setor = cadastro, não desenvolvimento.
- **Treinamento → matriz pessoa × norma**; alerta avaliado e **persistido como snapshot** no momento do registro (status muda com o tempo).
- **Modo de captura do bot → "Captura Contínua"** (ver §7).
- **Painel do gestor → React sob medida** sobre a API Prisma (ver §8). Payload CMS e AdminJS descartados.
- **Processo:** documento de arquitetura **aprovado antes** de codar Prisma/migrations; manter a base atual funcionando durante a transição.

---

## 6. Arquitetura de dados alvo (multi-setor)

Distinção essencial: **`usuario`** (quem opera o bot — engenheiro/gestor, identificado por telefone) **≠ `pessoa`** (mão de obra citada na legenda, identificada por matrícula/aliases, sujeita à verificação de treinamento).

Entidades propostas:

- **Configuração:** `setor`, `tipo_ativo` (hierarquia self-ref por setor), `prefixo_codigo` (prefixo → tipo de entidade).
- **Ativos:** `empresa`, `projeto` (escopo de relatório), `ativo` (árvore self-ref, `qrcode_token` nullable, `atributos` JSONB). Civil: Obra→Torre→Pavimento/Laje→Unidade→Local. Naval: Embarcação→Seção→Compartimento.
- **Normas:** `norma` (codigo único por setor, vigente, JSONB).
- **Pessoas:** `pessoa` (matricula, status), `pessoa_alias` (para casamento por texto/IA), `competencia` (pessoa × norma, status, validade).
- **Máquinas:** `maquina`, `checklist_template`, `checklist_item`, `vistoria_maquina` (validade_ate, resultado), `vistoria_maquina_item`.
- **Registros:** `entrada` (evolui a atual; ganha projeto_id/ativo_id/setor_id/categoria), `entrada_media`, **`entrada_mencao`** (polimórfica: entidade_tipo/id + origem + confianca + confirmado — peça-chave do caminho híbrido), `alerta` (tipo, severidade, status — snapshot).
- **v2:** `scan_sessao` (QR → herança de `ativo` nos registros).
  **Regras de alerta:** `PESSOA_NAO_TREINADA`, `MAQUINA_SEM_VISTORIA`, `MAQUINA_VISTORIA_VENCIDA`, `NORMA_NAO_ENCONTRADA`.

---

## 7. Fluxo do bot — Modo Captura Contínua

Reduz o atrito de ~6 toques por foto para "foto + ✓".

- Engenheiro entra **uma vez** (menu → Diário → Incluir → empresa) e o bot fica em estado **`CAPTURE_DIARIO`** (não chama `resetToMenu`; persiste tipo/empresa).
- **Foto com legenda:** a legenda do WhatsApp vira a descrição; cria a `entrada` **completa de uma vez** (elimina a entrada órfã) + extrai vínculos; bot **só reage com ✓** na imagem (sem mensagem).
- **Foto sem legenda** _(decisão do cliente)_: o bot **avisa e pede a descrição**. Tratamento por **fila FIFO** de pendentes + pedido consolidado; cada texto seguinte preenche a próxima foto (reply citando a imagem) e então marca ✓.
- **Confirmação** _(decisão do cliente)_: **apenas a reação ✓**, sem mensagens por foto. Exceção: um resumo único ao **encerrar** a sessão.
- **Saída:** `fim`/`menu`/`0` ou timeout por inatividade. Default: **1 foto = 1 registro**.
- **A validar (card B2):** se o engine do WAHA suporta **reação** (hoje o `wahaClient` só tem sendText/sendFile/download); senão, fallback textual mínimo.

---

## 8. Interface do gestor (web)

- **React sob medida** sobre a API do backend Node/Prisma. Motivo: o painel é **operacional** (alertas, vistorias, triagem, relatórios), muito bespoke e dirigido por configuração — onde CMS (Payload é React, mas quer ser dono do schema → conflito com Prisma) e scaffolding (AdminJS/Refine) atrapalham.
- **Princípios:** contrato de **API desacoplado** (REST/GraphQL) — preserva opção de Vue/mobile depois; **RBAC multi-tenant** por empresa/projeto/setor **desde o início**; **renderização por metadados** (telas/forms a partir da config por setor → cada setor novo custa pouco).
- **Libs recomendadas:** TanStack Table + TanStack Query, react-hook-form + zod, design system (shadcn/ui ou equivalente). "Sob medida" ≠ "do zero".
- **Escala:** performance mora no backend/Postgres (índices, paginação, materialized views), não no framework do front.

---

## 9. Divisão do trabalho e backlog

Dois devs em paralelo:

- **Trilha A — Estrutura do Banco** → responsável: **o usuário (você)**.
- **Trilha B — Aplicação / Bot / API / Painel** → o outro dev.
- **Fundação (juntos primeiro):** contrato de API + ambiente/migrations — destrava o paralelismo (B trabalha contra mock do contrato).
  **Backlog no Notion (kanban oficial deste produto):**
  https://app.notion.com/p/2f86af9e27d44603aee06b1c34736a0b
  (Board dedicado "Diário das Obras — Backlog v1", colunas To-do/Doing/Done, formato user story, sem épicos.)

Cards: **F1** contrato de API/convenções · **F2** ambiente/migrations · **A1** núcleo multi-setor · **A2** projeto+ativo+backfill · **A3** normas · **A4** pessoas+aliases+competência · **A5** máquinas+checklist+vistorias · **A6** evolução de entrada+entrada_mencao+alerta · **A7** dívidas técnicas do legado · **A8** seeds por setor · **B1** captura contínua · **B2** legenda + reação ✓ (validar WAHA) · **B3** fila de fotos sem legenda · **B4** parser de códigos · **B5** motor de alertas · **B6** API REST · **B7** painel React (fundação+RBAC) · **B8** painel Diário/Alertas/Triagem · **B9** painel Cadastros · **FUT1** IA de extração · **FUT2** QR (v2) · **FUT3** outros tipos de mídia · **FUT4** relatórios por período/dashboards.

Caminho crítico: **A6** depende de A2–A5; é o gargalo entre as trilhas.

---

## 10. Decisões em aberto (fechar antes de codar o Prisma)

1. **"Atividade" como entidade própria?** Hoje a competência ancora em `norma`. Se houver serviços sem norma, criar `atividade` ligada à norma.
2. **`pessoa` global ou por projeto?** Assumido por empresa/projeto; revisar se o trabalhador circula entre obras (talvez N:N global).
3. **Lista real de prefixos** (PS/MX/MAT/NV…) — validar com o cliente para popular `prefixo_codigo`.
4. **Stack do front** (Vite vs Next.js) — a definir.
5. **Padronização `snake_case` do legado** — agora ou adiar (com `@@map`).

---

## 11. Convenções e observações

- Entregáveis em **Markdown (.md)** preferidos; respostas estruturadas em seções com **negrito** nos pontos cruciais; detalhamento técnico alto, linguagem executiva.
- Trabalho **agêntico** (ler arquivos antes de propor) e **perguntas de esclarecimento antes de executar**.
- **`brand-voice.md` não está disponível** — validação de tom pendente; anexar quando existir.
- Tabelas novas em `snake_case`; legado em PascalCase mapeado (ver decisão §10.5).

---

## 12. Entregáveis já produzidos

1. **Mapeamento técnico** do código atual (`mapeamento-diario-das-obras.md`).
2. **Estrutura do banco atual** reconstruída do schema (`estrutura-banco-diario-das-obras.md`).
3. **Arquitetura de dados v1** (proposta multi-setor) (`arquitetura-dados-diario-das-obras-v1.md`).
4. **Backlog Kanban** no Notion (link na §9).
5. **Simulação interativa** do fluxo WhatsApp com ✓ (widget renderizado no chat).
6. **Mockup do painel do gestor** (`painel-gestor-diario-das-obras.html`) — dados fictícios, proposta de direção visual.
   > **Próximo passo natural:** fechar a §10 → escrever o **schema Prisma + migrations** na ordem da §9, mantendo a base atual no ar.
