# FrontEnd Architecture

Modern frontend application built with Vite, React 19, TanStack Router, TanStack Query, Zustand, and ShadCN UI.

## Stack Overview

| Technology      | Purpose                 |
| --------------- | ----------------------- |
| React 19        | UI Library              |
| TanStack Router | File-based routing      |
| TanStack Query  | Server state management |
| Zustand         | Client state management |
| ShadCN UI       | Component library       |
| Tailwind CSS 4  | Styling                 |
| Zod             | Schema validation       |
| React Hook Form | Form management         |
| i18next         | Internationalization    |
| Biome           | Linting & Formatting    |
| Vite            | Build tool              |

## Project Structure

```
src/
├── components/
│   ├── ui/                  # ShadCN components
│   ├── selects/             # Specialized Select components (example: CustomerSelect)
│   ├── sidebar/, nav-actions/  # App shell (sidebar, theme/language/enterprise switchers)
│   └── *.tsx                # Pattern components (graphs, stats, tables, forms, etc.)
├── hooks/                   # Global reusable hooks (auth, permissions, example: use-customers-api)
├── lib/
│   ├── api/client.api.ts    # API client
│   ├── config/
│   │   ├── i18n.config.ts       # i18n configuration
│   │   ├── routes.config.ts     # Route registry (MAIN_ROUTES, icons, permission map)
│   │   └── translations/        # pt.json, en.json, es.json
│   ├── const/, helpers/, utils/
└── routes/
    ├── _public/             # Public routes (auth, sso-redirect)
    └── _private/            # Authenticated routes (permissions/, register/customers example)
```

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Type checking
pnpm check

# Format code
pnpm format

# Lint code
pnpm lint

# Build for production
pnpm build
```

## Development Workflow

### Creating a New Route

1. Create a folder in `src/routes/_private/`
2. Add `index.tsx` for the main page
3. For subpages like `add` or `details`, create a subfolder with its own `index.tsx` (DO NOT use `$id.tsx` or route variables). Route parameters must be handled via Search Params.
4. Add subfolders: `@components/`, `@hooks/`, `@interface/`
5. Use the Shell Pattern: `<Card>` → `<CardHeader>` → `<CardContent>`

### API Integration

1. Check if hook exists in `src/hooks/`
2. If not, create a new hook using TanStack Query
3. Use `api` from `@/lib/api/client`

### Forms

1. Define Zod schema in `@interface/`
2. Create form hook in `@hooks/` using React Hook Form
3. Use ShadCN form components

### Translations

1. Add keys to `src/lib/config/translations/pt.json` (default)
2. Add translations to `en.json` and `es.json`
3. Use `const { t } = useTranslation()` in components
4. See `docs/i18n.md` for the key-reuse protocol — search before creating a new key

## Available Commands

| Command       | Description                   |
| ------------- | ----------------------------- |
| `pnpm dev`    | Start dev server on port 3000 |
| `pnpm build`  | Build for production          |
| `pnpm check`  | TypeScript type checking      |
| `pnpm format` | Format code with Biome        |
| `pnpm lint`   | Lint and fix with Biome       |

## VSCode Extensions

- **Inlang (Sherlock)** - i18n management
- **Tailwind CSS IntelliSense** - Tailwind autocomplete
- **Biome** - Code formatting

## Component Patterns

| Pattern                              | Reference File                           |
| ------------------------------------- | ----------------------------------------- |
| Statistics / KPI                      | `src/components/default-KPI.tsx`         |
| Table w/ pagination                   | `src/components/default-table.tsx`       |
| Form layout                           | `src/components/default-form-layout.tsx` |
| Empty state                           | `src/components/default-empty-data.tsx`  |
| Loading state                         | `src/components/default-loading.tsx`     |
| Charts (area/bar/pizza/line/radial)   | `src/components/graph-*.tsx`             |

## Example Module

`src/routes/_private/register/customers/` demonstrates the full page pattern end-to-end: hub entry, list with search/pagination, add form, local `@interface`/`@hooks`/`@components`, paired with `src/hooks/use-customers-api.ts` and `src/components/selects/customer-select.tsx`. Copy this structure when starting a new module.

The `permissions/` module (`roles/`, `users/`) ships as complete, working RBAC admin UI — reuse it as-is in new products.

See `docs/` for the full set of architecture/convention references (`page-patterns.md`, `api-hooks.md`, `form-hooks.md`, `schemas-types.md`, `charts.md`, `i18n.md`, `checklist.md`, `available-resources.md`).
