# Segurança — Bykonz Marine Platform

## 1. Autenticação

- **JWT** (access token) para autenticação.
- **Refresh Token** para renovação segura de sessão.
- Tokens armazenados de forma segura (httpOnly cookies ou memória + refresh token persistido).

## 2. Autorização (RBAC)

- **Controle de permissões por perfil** (roles).
- Perfis: `ADMIN`, `MANAGER`, `TECHNICIAN`, `VIEWER` (extensível).
- Middleware de autorização por rota e por módulo.

## 3. Auditoria Completa

- **Histórico de alterações** — trilha de auditoria por registro.
- **Logs de acesso** — quem acessou o quê e quando.
- **Versionamento de registros** — cada update incrementa a versão e guarda o `before/after`.
- **Proteção contra exclusão acidental** — soft-delete em vez de delete físico.

## 4. Estrutura de Segurança

```
src/modules/users/
  auth/          # Login, logout, refresh token
  permissions/   # RBAC, checagem de permissões
  audit/         # Auditoria de ações
  versioning/    # Versionamento de registros
```

## 5. Proteção de Dados

- Senhas com `bcrypt`.
- Secrets em variáveis de ambiente (`.env`).
- Validação de entrada em todos os controllers.
- Rate limiting por rota.
- Helmet para headers de segurança.
- CORS restrito a origens configuradas.

## 6. Refresh Token

```
POST /auth/login         → { accessToken, refreshToken, user }
POST /auth/refresh       → { accessToken } (valida refreshToken)
POST /auth/logout        → revoga refreshToken
```

- Refresh tokens armazenados em `refresh_tokens` (tabela) com expiração.
- Rotação de refresh tokens (a cada renovação, emite novo).
- Revogação de sessão (logout) e detecção de reuso.

## 7. Auditoria de Ações

Cada ação crítica registra:
- `actorType` / `actorId` (quem)
- `action` (o quê)
- `entityType` / `entityId` (em quê)
- `metadata` (detalhes, incl. `before`/`after` para edições)
- `createdAt` (quando)
