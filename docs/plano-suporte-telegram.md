# Plano: Suporte a Telegram como canal alternativo ao WhatsApp/WAHA

> ⚠️ **Revisão v1.1 (2026-07-16) — implementação AINDA NÃO confirmada.**
> As decisões de produto abaixo mudaram numa conversa posterior. Em especial, a
> **flag global `ACTIVE_CHANNEL` foi descartada** em favor de **canal por empresa com
> os dois canais ativos ao mesmo tempo**. Ver a seção
> [**Revisão v1.1**](#revisão-v11--canal-por-empresa-decisões-atualizadas) para o que
> vale hoje. O corpo original (§Context em diante) fica como histórico; trechos
> marcados com ~~tachado~~/nota estão obsoletos.

## Context

O backend (`whatsapp-management-backend`, Express + TS + Prisma) hoje opera um bot de
"diário de obra" **só via WhatsApp** usando o serviço WAHA. Queremos permitir que a
empresa use **Telegram** no lugar do WhatsApp, com **exatamente o mesmo fluxo de
conversa** nesta v1, trocando apenas a plataforma de mensageria por baixo.

Decisões de produto (confirmadas com o usuário):
- ~~**Um canal por vez.** A instância/empresa escolhe ser oficialmente WhatsApp **ou**
  Telegram — não os dois simultaneamente. Modelamos isso como uma **flag global de
  canal ativo** (`ACTIVE_CHANNEL`), já que hoje tudo roda numa sessão única.~~
  **[OBSOLETO na v1.1]** — passou a ser **canal por empresa** (`Company.activeChannel`)
  com **ambos os canais ativos simultaneamente**. Ver [Revisão v1.1](#revisão-v11--canal-por-empresa-decisões-atualizadas).
- **v1 = conversa privada 1:1** com o bot (grupos/escuta de grupo ficam para depois).
- **Identidade do operador no `User`**: adicionar `telegramUserId` ao lado de
  `phoneE164`. O match de acesso passa a ser por telefone (WhatsApp) **ou** por
  telegram id (Telegram).
- **Cadastro do canal fica no nível do operador (User)** na v1 — o painel de usuários
  do bot ganha o campo de Telegram. (Campo "canal preferido" na Company fica para uma
  fase futura, quando houver roteamento por obra/grupo.)

O código já está bem posicionado: mensageria de saída e download de mídia já vivem
atrás de **ports** (`MessagingClient` / `MediaDownloader` em
[src/flows/types.ts](src/flows/types.ts)), e a mídia hoje é entregue como URL
(`payload.media.url`) que o `WahaClient` baixa. Precisamos generalizar 5 pontos de
acoplamento a WAHA e adicionar um adaptador Telegram espelhando o WAHA.

Resultado esperado: com `ACTIVE_CHANNEL=telegram` e um `TELEGRAM_BOT_TOKEN`
configurados, o mesmo fluxo do diário de obra funciona por Telegram, respondendo no
privado ao operador cadastrado — sem tocar na máquina de estados do fluxo.

---

## Revisão v1.1 — canal por empresa (decisões atualizadas)

> Status: **decisões de produto fechadas, implementação ainda não iniciada / não
> confirmada.** Esta seção substitui os pontos conflitantes do plano original.

### Contexto da revisão
O schema é **multi-tenant**: existem várias `Company`, e um mesmo operador (`User`)
pode pertencer a mais de uma empresa via `UserCompany` (N:N). A identidade hoje é o
`User.phoneE164` (único global). Por isso a ideia de "um canal global" não encaixa: a
empresa é que "usa WhatsApp OU Telegram", e empresas diferentes podem estar em canais
diferentes ao mesmo tempo.

### Decisões (confirmadas com o usuário em 2026-07-16)
1. **Canal por empresa, ambos ativos simultaneamente.** WAHA e Telegram rodam ao mesmo
   tempo. Cada empresa é marcada como WhatsApp **ou** Telegram via
   `Company.activeChannel`. **Não há** flag global `ACTIVE_CHANNEL`. A infra é
   compartilhada (uma sessão WAHA + um bot Telegram servem todas as empresas); o campo
   por empresa diz qual canal os operadores daquela empresa usam. Empresa A pode estar
   no WhatsApp e a empresa B no Telegram simultaneamente.
2. **Roteamento por canal de chegada.** O canal de resposta é aquele em que a mensagem
   chegou (WAHA → WhatsApp; webhook Telegram → Telegram). O `activeChannel` da empresa
   governa: onboarding no painel, auto-report (fase futura p/ Telegram) e o **filtro das
   empresas selecionáveis no fluxo** (numa mensagem que chegou por Telegram, só aparecem
   empresas com `activeChannel = TELEGRAM`) — é isso que dá sentido concreto à config
   por empresa.
3. **UX Telegram v1 = espelhar o menu numerado** do WhatsApp (mesmo texto). Botões
   inline / teclados nativos ficam para depois (o operador pediu p/ manter simples na
   v1, evoluir depois). Isso mantém `DiarioDasObrasFlow` intocado.
4. **Config no painel = nova seção "Configurações da empresa"** com seletor de canal
   ativo por empresa + link/username do bot e instruções de onboarding (design system
   IoTLog). Exige um `PUT /companies/:id` no backend (hoje só há `GET /companies`).
5. **Identidade do operador no `User`** — mantém-se `telegramUserId` ao lado de
   `phoneE164` (como no plano original).

### Impacto no plano original (o que muda)
- **§Context, "Um canal por vez" / `ACTIVE_CHANNEL`:** descartado — ver decisão 1.
- **§8 Config:** sem `activeChannel` global no env. `WAHA_*` e `TELEGRAM_BOT_TOKEN`
  viram **opcionais e independentes**; exigir **pelo menos um** canal configurado (erro
  se nenhum). A seleção de canal deixa de ser via env.
- **§9 DI wiring:** em vez de escolher **um** cliente por `config.activeChannel`,
  instanciar **os dois** clientes disponíveis (WahaClient se vars WAHA presentes;
  TelegramClient se token presente) e montá-los atrás de um
  **`ChannelRouterClient`** — um `MessagingClient`+`MediaDownloader` que despacha pelo
  **prefixo do `chatId`/`ref`** (`tg:` → Telegram; caso contrário WAHA). Assim o
  `ConversationService` e o fluxo continuam chamando `messaging`/`mediaDownloader` sem
  saber de canal. O prefixo `tg:` é aposto no adapter de entrada e removido pelo
  `TelegramClient` ao enviar (consistente com o namespacing de `chatId` da §4).
- **§4 ConversationService:** além da resolução de identidade por `identity.kind`,
  aplicar o **filtro de empresas por `activeChannel`** (decisão 2).
- **§7 Rota de webhook:** as **duas** rotas (`/webhooks/waha` e `/webhooks/telegram`)
  ficam sempre ativas (não condicionadas a um canal global).
- **§10 Schema Prisma:** além de `User.telegramUserId`, adicionar
  `Company.activeChannel` (enum `Channel { WHATSAPP TELEGRAM }`, default `WHATSAPP`).
  Migration sugerida: `add_telegram_channel_support`.
- **§UI/UX:** o "indicador de canal ativo" global (selo único) **não se aplica** —
  vira **badge por empresa/operador** + a nova seção de Configurações da empresa
  (decisão 4). O restante da UI/UX do plano permanece.

### Ordem de execução proposta (quando aprovado)
Núcleo neutro + roteamento + Telegram (adapters/cliente/rota) → schema + migration →
testes (build/vitest) → frontend (campo Telegram no cadastro + seção de config da
empresa). Validar `npm run build` e `npx vitest run` antes de rodar a migration.

### Ainda em aberto / a confirmar antes de codar
- Se o filtro de empresas por canal (decisão 2) deve **esconder** empresas do outro
  canal ou apenas **avisar** — assumindo esconder por ora.
- Auto-report por Telegram (grupos) segue **fora de escopo**; o job continua WAHA-only.
- Nome da tabela `whatsapp_conversation_states` fica como está (legado) para evitar
  churn de migration, mesmo passando a guardar `chatId` com prefixo `tg:`.

---

## Arquitetura & boas práticas

**Princípio: o núcleo (ConversationService + DiarioDasObrasFlow) já é channel-agnóstico
por design.** A estratégia é *empurrar* toda a especificidade de canal para as bordas
(adaptadores em `src/lib/`, rota de webhook em `src/app.ts`, normalização de payload) e
deixar o miolo consumir tipos neutros.

Cinco pontos de acoplamento WAHA a generalizar (todos já mapeados no código):

1. **Webhook de entrada tipado como WAHA** — `WebhookHandler.handleWebhook(WahaWebhook)`
   ([src/app.ts:7](src/app.ts#L7)) e `ConversationService.handleWebhook`
   ([src/services/conversationService.ts:48](src/services/conversationService.ts#L48)).
2. **Identidade por telefone** — `extractPhoneFromWahaPayload` / candidatos BR
   ([src/utils/phone.ts](src/utils/phone.ts)) + `User.phoneE164`.
3. **Fluxo lê `WahaMessagePayload` direto** — `FlowHandleInput.payload`
   ([src/flows/types.ts:221](src/flows/types.ts#L221)); acessos a `payload.media.url`,
   `payload.hasMedia`, `payload.body`, `payload.id` em
   [src/flows/DiarioDasObras/index.ts](src/flows/DiarioDasObras/index.ts) (linhas 759,
   897, 1319 etc.).
4. **`MediaDownloader.download(url)`** assume URL — Telegram entrega `file_id` que exige
   uma chamada `getFile` antes de baixar.
5. **Job de auto-report** usa `obra.whatsappGroupId` + `messaging` WAHA
   ([src/jobs/dailyReportJob.ts](src/jobs/dailyReportJob.ts)). **Fora do escopo da v1**
   (grupos são fase futura) — apenas garantimos que ele continua funcionando quando
   `ACTIVE_CHANNEL=whatsapp`.

### Abordagem escolhida: tipo de mensagem neutro + adaptadores por canal

Introduzir um **`IncomingMessage` neutro** e fazer o núcleo consumir ele em vez de
`WahaMessagePayload`. Cada canal traduz seu payload cru → `IncomingMessage` num
**adapter de entrada**. A mídia deixa de ser "URL" e passa a ser uma **referência
opaca** que o `MediaDownloader` do canal sabe resolver.

```
Telegram Update ─┐                              ┌─ TelegramClient (send/download)
                 ├─→ adapter → IncomingMessage ─→ ConversationService → Flow
WAHA Webhook ────┘                              └─ WahaClient (send/download)
```

Isso mantém `DiarioDasObrasFlow` **intocado na lógica**, mudando só o *tipo* que ele lê.

---

## Mudanças por arquivo

### 1. Tipo de mensagem neutro (`src/types/message.ts` — novo)
Definir o contrato channel-agnóstico:
```ts
export interface IncomingMediaRef {
  /** Referência opaca resolvida pelo MediaDownloader do canal.
   *  WAHA: a URL. Telegram: o file_id. */
  ref: string;
  mimetype?: string | null;
  filename?: string | null;
}
export interface IncomingMessage {
  channel: "whatsapp" | "telegram";
  chatId: string;        // destino p/ responder (namespaced por canal, ver §4)
  messageId?: string;
  text: string;
  media?: IncomingMediaRef | null;
  /** Identidade crua p/ o resolvedor do canal (telefone-digits ou telegram id). */
  identity: { kind: "phone" | "telegram"; value: string; raw?: Record<string, unknown> };
}
```

### 2. Generalizar os ports (`src/flows/types.ts`)
- `MediaDownloader.download(ref: string)` — trocar o nome do parâmetro de `url` p/ `ref`
  (assinatura já compatível; só semântica). `WahaClient` continua tratando como URL.
- `FlowHandleInput.payload: WahaMessagePayload` → `payload: IncomingMessage`.
- Atualizar `ConversationStore.findUserByPhone` — manter, e **adicionar**
  `findUserByTelegramId(telegramUserId: string)`.
- `UserRecord` ganha `telegramUserId?: string | null`.

### 3. Atualizar o fluxo (`src/flows/DiarioDasObras/*.ts`)
Substituir os acessos WAHA por campos neutros — é mecânico e localizado (linhas já
listadas via grep):
- `payload.hasMedia && payload.media?.url` → `payload.media?.ref`
- `mediaDownloader.download(media.url)` → `mediaDownloader.download(media.ref)`
- `payload.body` → `payload.text`
- `payload.id` → `payload.messageId`
Nenhuma mudança de steps/máquina de estados.

### 4. ConversationService channel-agnóstico (`src/services/conversationService.ts`)
- `handleWebhook` passa a receber `IncomingMessage` (já normalizado pela borda) em vez
  de `WahaWebhook`. Toda a lógica de `isSupportedWebhook` (filtro de evento/`fromMe`)
  migra para o **adapter de entrada** de cada canal.
- Resolução de identidade: se `identity.kind === "phone"` → usa
  `getWahaPhoneLookupCandidates` + `findUserByPhone` (comportamento atual);
  se `=== "telegram"` → `findUserByTelegramId`.
- **Namespacing de `chatId`**: como o estado de conversa é keyed por `chatId`
  ([WhatsappConversationState](prisma/schema.prisma#L573)), prefixar por canal para
  evitar colisão (ex.: `tg:<chat_id>`, WhatsApp mantém o JID atual). O adapter monta
  esse `chatId`; ao **enviar**, o `TelegramClient` remove o prefixo `tg:`.
- Mensagem de "não cadastrado" e reset commands: reutilizadas como estão.

### 5. Adapters de entrada (bordas)
- **WAHA** (`src/channels/waha/inbound.ts` — mover a lógica de `isSupportedWebhook` +
  `extractPhoneFromWahaPayload` p/ cá): `WahaWebhook → IncomingMessage | null`.
- **Telegram** (`src/channels/telegram/inbound.ts` — novo): `TelegramUpdate →
  IncomingMessage | null`. Extrai `message.text`/`caption`, resolve mídia
  (`photo[].file_id` maior, `document.file_id`), `identity = { kind:"telegram",
  value: String(message.from.id) }`, ignora updates sem `message`.

### 6. TelegramClient (`src/lib/telegramClient.ts` — novo, espelha `WahaClient`)
Implementa `MessagingClient` + `MediaDownloader` via Bot API
(https://core.telegram.org/bots/api), usando `fetch` nativo (padrão do projeto):
- `sendText(chatId, text)` → `POST /bot<token>/sendMessage` `{chat_id, text}`.
- `sendFile(chatId, {mimetype, filename, data}, caption)` → `sendDocument`
  (multipart com o buffer base64 decodificado) — usado p/ os PDFs do diário.
- `download(ref /* file_id */)` → `getFile` p/ obter `file_path`, depois baixar de
  `https://api.telegram.org/file/bot<token>/<file_path>`.
- `static fromConfig(config)` lendo `telegramBotToken`.

### 7. Rota de webhook Telegram (`src/app.ts`)
Adicionar `POST /webhooks/telegram` espelhando `/webhooks/waha` (mesmo rate limiter;
validação via **secret token no header** `X-Telegram-Bot-Api-Secret-Token`, que o
Telegram envia quando registramos o webhook com `secret_token`). Generalizar
`WebhookHandler` p/ um handler por canal, ou registrar dois handlers. Cada rota chama
seu adapter → `IncomingMessage` → `conversationService.handleWebhook(msg)`.

### 8. Config (`src/config/env.ts` + `.env.example`)
- Adicionar `activeChannel: "whatsapp" | "telegram"` (env `ACTIVE_CHANNEL`, default
  `whatsapp`).
- Adicionar `telegramBotToken?`, `telegramWebhookSecret?`.
- **Tornar as vars WAHA obrigatórias condicionais**: só exigir `WAHA_*` quando
  `ACTIVE_CHANNEL=whatsapp`; exigir `TELEGRAM_BOT_TOKEN` quando `=telegram`. Ajustar a
  lista `required`.

### 9. DI wiring (`src/container.ts`)
Selecionar o adaptador conforme `config.activeChannel`:
```ts
const client = config.activeChannel === "telegram"
  ? TelegramClient.fromConfig(config)
  : WahaClient.fromConfig(config);
// messaging: client, mediaDownloader: client
```
Idem em `createDailyReportJobDeps`.

### 10. Schema Prisma (`prisma/schema.prisma`) + migration
`model User`: adicionar `telegramUserId String? @unique @map("telegram_user_id")`.
Gerar migration (`prisma migrate dev --name add_user_telegram_id`). `phoneE164`
deixa de ser a única identidade — manter `@unique`, mas telefone passa a ser opcional
para operadores Telegram numa fase futura (na v1 manter obrigatório p/ não quebrar
dados existentes; avaliar tornar nullable só se necessário).
Atualizar `PrismaConversationStore` ([src/services/prismaConversationStore.ts](src/services/prismaConversationStore.ts))
com `findUserByTelegramId` e incluir `telegramUserId` no `UserRecord` retornado por
`findUserByPhone`.

### 11. Registro do webhook Telegram (operacional)
O Telegram exige registrar a URL do webhook uma vez (`setWebhook`). Adicionar um script
npm (`telegram:set-webhook`) que chama `POST /bot<token>/setWebhook` com a URL pública +
`secret_token`. Documentar no README.

---

## UI / UX (painel do gestor — frontend)

Escopo v1, alinhado a "cadastro do canal no nível do operador":

1. **Cadastro de usuário do bot** — a tela
   [frontend/src/routes/_private/cadastros/usuarios/add-whatsapp](frontend/src/routes/_private/cadastros/usuarios/add-whatsapp)
   ganha, além do telefone, um campo **Telegram ID** (opcional). Sugestão de UX:
   - Rótulo neutro na lista ("Usuários do bot", não "WhatsApp"), com um **badge de canal**
     (ícone WhatsApp/Telegram) por operador conforme qual identidade está preenchida.
   - Ajuda contextual: "Peça ao operador para enviar `/start` ao bot; o painel mostrará
     o Telegram ID capturado para vincular" (fase 2 — na v1 o admin digita o id).
2. **Indicador de canal ativo** — um selo global no topo/rodapé do painel mostrando
   qual canal está ativo (lido de um endpoint `/api/v1/config/channel` que expõe
   `activeChannel`). Deixa claro para o gestor "estamos operando via Telegram".
3. **Copiar-e-colar do onboarding** — na tela de usuários, um bloco com o
   **link/username do bot** (`t.me/<bot>`) e instruções curtas de primeiro acesso,
   seguindo o design system IoTLog (usar a skill `iotlog-design` para os componentes).
4. **Consistência de nomenclatura** — evitar "WhatsApp" hardcoded em labels que agora
   são multi-canal; preferir "canal"/"bot". Manter as telas de obras/relatórios como
   estão (grupos são fase futura).

*Observação de escopo:* o campo "canal preferido na empresa" e a escuta de grupos foram
explicitamente adiados; a UI acima não os inclui.

---

## Arquivos críticos

Backend (novos): `src/types/message.ts`, `src/lib/telegramClient.ts`,
`src/channels/telegram/inbound.ts`, `src/channels/waha/inbound.ts`,
`src/types/telegram.ts` (tipos do Update).
Backend (editar): [src/flows/types.ts](src/flows/types.ts),
[src/services/conversationService.ts](src/services/conversationService.ts),
[src/services/prismaConversationStore.ts](src/services/prismaConversationStore.ts),
[src/flows/DiarioDasObras/index.ts](src/flows/DiarioDasObras/index.ts) (+ irmãos que
leem `payload`), [src/app.ts](src/app.ts), [src/config/env.ts](src/config/env.ts),
[src/container.ts](src/container.ts), [prisma/schema.prisma](prisma/schema.prisma),
`.env.example`, `package.json` (script setWebhook).
Frontend: [frontend/src/routes/_private/cadastros/usuarios/add-whatsapp](frontend/src/routes/_private/cadastros/usuarios/add-whatsapp)
e a lista/`@interface` de usuários.

Reutilizar (não recriar): ports `MessagingClient`/`MediaDownloader`, todo o
`DiarioDasObrasFlow`, `S3ObjectStorage`, `PdfReportGenerator`, `DailyReportService`,
`getWahaPhoneLookupCandidates`, o padrão `fromConfig` dos adaptadores.

---

## Verificação (end-to-end)

1. **Typecheck + testes** do backend: `npm run build` e `npx vitest run`. Ajustar/estender
   `tests/wahaClient.test.ts` (agora `payload` neutro) e adicionar
   `tests/telegramClient.test.ts` (mock de `fetch` p/ sendMessage/sendDocument/getFile) e
   um teste de `telegram/inbound.ts` (Update → IncomingMessage). O usuário testa a UI no
   browser (não usar Playwright).
2. **Migration** aplica limpo: `npx prisma migrate dev` e `npx prisma generate`.
3. **Fluxo real Telegram** (manual, em staging):
   - Criar bot via BotFather, `ACTIVE_CHANNEL=telegram` + `TELEGRAM_BOT_TOKEN` no `.env`.
   - Rodar `npm run telegram:set-webhook` apontando para a URL pública (ngrok/staging).
   - Cadastrar um `User` com o `telegramUserId` próprio pelo painel.
   - Enviar `menu` ao bot no privado → confirmar que o menu do diário aparece, que uma
     foto com legenda cria `Entry` + `EntryMedia` (checar S3 + DB), e que "gerar diário
     de obra" devolve o mesmo PDF.
4. **Regressão WhatsApp**: com `ACTIVE_CHANNEL=whatsapp`, repetir um fluxo curto por WAHA
   para garantir que a generalização não quebrou o canal existente (webhook `/webhooks/waha`,
   match por telefone, mídia por URL, job de auto-report intacto).
