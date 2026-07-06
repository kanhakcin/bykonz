# src/hooks — Catalogo de Hooks Globais

> **ANTES de criar um novo hook**, verifique se o que voce precisa ja existe aqui.
> Para o padrao completo de implementacao, consulte [`docs/api-hooks.md`](../../docs/api-hooks.md).

---

## Estado Global (Zustand + persist)

| Hook                  | Arquivo                    | Proposito                                                                                                            |
| --------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `useAuth`             | `use-auth.ts`              | Token JWT, usuario decodificado, tipo de login (`normal`/`sso`), estado de conta bloqueada, remember email           |
| `useEnterpriseFilter` | `use-enterprise-filter.ts` | Empresa/tenant selecionado globalmente — `idEnterprise` usado por todos os hooks de API                              |
| `usePermissions`      | `use-permissions.ts`       | Cache de permissoes do usuario com `hasPermission(path)`, `useHasPermissions(paths[])`, `useRequirePermission(path)` |
| `useFavorites`        | `use-favorites.ts`         | Links favoritos (estrela visual): `toggleFavorite`, `isFavorite`                                                     |
| `useSidebarMenus`     | `use-sidebar-menus.ts`     | Menus/submenus visiveis na sidebar: `customized`, `visibleLinks`, `setVisibleLinks`, `reset`                         |
| `useSidebar`          | `use-sidebar-toggle.ts`    | Estado do sidebar (expandido/colapsado), suporte mobile e hover                                                      |
| `useIsMobile`         | `use-mobile.ts`            | Detecta viewport mobile (`boolean`)                                                                                  |
| `useLocale`           | `use-locale.ts`            | Locale atual para formatacao de datas e numeros                                                                      |

---

## Autenticacao

| Hook           | Arquivo           | Exporta                                                                                |
| -------------- | ----------------- | --------------------------------------------------------------------------------------- |
| Auth mutations | `use-auth-api.ts` | `useLogin`, `useRegister`, `useVerifyEmail`, `useRequestPasswordReset`, `useResetPassword`, `useSendUnlockCode`, `useVerifyUnlockCode` |

---

## Permissoes (RBAC)

| Hook              | Arquivo                  | Proposito                                    |
| ----------------- | ------------------------ | --------------------------------------------- |
| Roles CRUD        | `use-roles-api.ts`       | CRUD de roles, atribuicao de paths e usuarios |
| Usuarios CRUD      | `use-users-api.ts`       | CRUD de usuarios do sistema                   |
| Usuarios sem role  | `use-users-not-in-role.ts` | Lista usuarios ainda nao vinculados a uma role |

---

## Empresas / Multi-tenant

| Hook             | Arquivo                 | Proposito                              |
| ---------------- | ------------------------ | --------------------------------------- |
| Empresas         | `use-enterprises-api.ts` | CRUD/listagem de empresas (tenants)     |

---

## Exemplo de modulo de negocio

| Hook       | Arquivo                 | Proposito                                                              |
| ---------- | ------------------------ | ------------------------------------------------------------------------ |
| Clientes   | `use-customers-api.ts`  | CRUD completo de `customers` — use como referencia ao criar um novo hook |

Padrao esperado ao criar `use-{entidade}-api.ts`: query keys centralizadas, hooks de query (`use{Entidade}`, `use{Entidade}Paginated`, `use{Entidade}Select`) e um hook de mutations (`use{Entidade}Api`) com `invalidateQueries` no `onSuccess`. Veja `use-customers-api.ts` para o exemplo completo.

---

## Outros

| Hook              | Arquivo               | Proposito                              |
| ----------------- | ---------------------- | ---------------------------------------- |
| Idiomas           | `use-languages-api.ts` | Lista de idiomas suportados             |
| Assistente de IA  | `use-ai-assistant.ts`  | Integracao com o modulo `ai-prompt`     |
| Notificacoes      | `use-notifications-api.ts` | Notificacoes do usuario (sino da navbar) |
