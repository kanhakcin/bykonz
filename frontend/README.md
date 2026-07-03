# Diário das Obras — Painel do Gestor (frontend)

Painel web do gestor (cards **B7/B8** do backlog): visão do dia com KPIs, feed do diário
vindo do WhatsApp, alertas de conformidade e triagem de vínculos da IA.

## Stack

- **React 19 + Vite + TypeScript** (SPA)
- **Tailwind CSS 4** com tokens do design system
- **TanStack Query** (dados), **React Router** (rotas)
- Ícones **Lucide** (regra do design system: nunca emoji)

## Design system

A linguagem visual é o **IoTLog Design System (Bykonz)**, importado do Claude Design em
[`../.claude/skills/iotlog-design/`](../.claude/skills/iotlog-design/) — leia o `README.md`
de lá para as regras completas.

- `src/styles/tokens.css` — tokens de cor (4 temas: light, dark, ocean-blue, sunset), tipografia e forma
- `src/styles/components.css` — vocabulário de componentes (sidebar flutuante, card shell, botões, badges, KPI…)
- Fontes: **SF Pro Display** (corpo, em `public/fonts/`) e **League Spartan** (chrome de UI, Google Fonts)
- O botão de tema na sidebar circula light → dark → ocean-blue

## Rodando

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + build de produção
```

## Dados: API real ou mock

As telas consomem apenas o contrato `DiaryApi` (`src/api/types.ts`, em inglês), que espelha
a API REST do backend (`src/api/panelRouter.ts` no repo raiz) sobre a arquitetura de dados
v1 (tabelas em inglês: `entries`, `entry_mentions` com source/confidence, `alerts` snapshot).

- **Com `VITE_API_URL` definido** (ex.: `VITE_API_URL=http://localhost:8080 npm run dev`) —
  usa a API real (`src/api/http.ts`). Login: qualquer e-mail + a senha é o `PANEL_API_TOKEN`
  configurado no backend.
- **Sem `VITE_API_URL`** — usa o mock (`src/api/mock.ts`, dados ilustrativos; qualquer
  e-mail/senha entram).

## Estrutura

```
src/
  api/          contrato + mock + hooks TanStack Query
  components/   ui.tsx (primitivas), Sidebar, Shell
  screens/      Login, Painel, Cadastros*, Relatorios*   (* placeholders)
  providers.tsx tema, sessão e toast
  styles/       tokens.css, components.css
```

Observação de escopo: o painel não tem seletor de setor — o setor (civil, naval, …)
virá da configuração do cliente via API.
