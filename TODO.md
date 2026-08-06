# TODO — AI Integration + Telegram Module

## Feature 1: AI Integration (assistant for technical reports)

### Backend
- [x] Create `src/services/aiService.ts` — provider-agnostic `AIService` facade wrapping `AiEngineService` (analyze, summarize, suggest causes, detect inconsistencies) with timeout/error/logging.
- [x] Create `src/api/aiAssistantRouter.ts` — authenticated `/api/v1/assistant/*` endpoints (analyze, summarize, accept, reject).
- [x] Wire router in `src/index.ts` + `src/app.ts`.
- [x] Add `AI_TIMEOUT_MS` env config (reuse existing OPENAI_* vars).
- [ ] Tests: `tests/aiService.test.ts`.

### Frontend
- [x] Create `frontend/src/hooks/use-ai-assistant-api.ts`.
- [x] AI assistant panel UI in technical report area.

## Feature 2: Telegram Module

### Backend
- [x] Create `src/services/telegramManagementService.ts` — dashboard, settings, conversations, messages, chats, send, logs.
- [x] Create `src/api/telegramServiceRouter.ts` — authenticated `/api/v1/telegram/*`.
- [x] Wire router in `src/index.ts` + `src/app.ts`.
- [ ] Tests: `tests/telegramService.test.ts`.

### Frontend
- [x] Create `frontend/src/hooks/use-telegram-api.ts`.
- [x] Create `/telegram/` page with tabs (Dashboard, Configurações, Mensagens, Canais, Envio, Logs).
- [x] Add route to `routes.config.ts`, `sidebar-routes.config.ts`, `nav-main.tsx`.
- [x] Add i18n keys to `pt.json`, `en.json`, `es.json`.

## Verify
- [ ] Backend typecheck / build.
- [ ] Frontend typecheck / build.
