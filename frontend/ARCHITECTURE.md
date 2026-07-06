# Padrões e arquitetura do Projeto

## Stack

| Categoria | Tecnologia | Versão |
|-----------|------------|--------|
| Runtime | Node.js | >=24 |
| Framework | React | 19 |
| Bundler | Vite | 7 |
| Router | TanStack Router | 1.x |
| Data Fetching | TanStack Query | 5.x |
| State | Zustand | 5.x |
| UI Library | ShadCN UI + Radix | - |
| Styling | TailwindCSS | 4.x |
| Forms | react-hook-form + zod | 7.x / 3.x |
| i18n | react-i18next | 16.x |
| Linter/Formatter | Biome | 2.x |
| Charts | Recharts + ECharts | 2.x / 6.x |

```
React 19 + TypeScript
├── Routing      → TanStack Router (file-based)
├── Server State → TanStack Query
├── Client State → Zustand (persist)
├── Forms        → react-hook-form + zod
├── UI           → ShadCN + Radix
└── Styling      → TailwindCSS 4
```

---

## Regras Críticas

### UI & Estilização

- **ShadCN UI** ( localizado em [**_`src/components/ui`_**](./src/components/ui) ).
- **Importante**: Evite tags HTML puras estilizadas ou estilizar os componentes `ShadCN`; utilize as propriedades padrão da biblioteca.
- **Paleta de Gráficos**: Para manter a consistência em gráficos (Recharts, etc), utilize a função utilitária [**_`getChartColor(index)`_**](./src/components/ui/chart). Ela cicla entre as cores padrão do Tailwind (Sky, Blue, Indigo, Violet, Purple, Fuchsia, Pink, Rose, Red, Orange, Amber, Yellow, Lime, Green, Emerald, Teal, Cyan) e tons (400, 500, 600...) conforme o índice aumenta, use `index * 2` para ter maior variação das cores.

### Internacionalização (i18n)

**IMPORTANTE**: Toda string visível ao usuário deve usar `t('chave')` do `react-i18next`. Sem exceções.

Toda chave deve ser adicionada aos arquivos [**_`pt.json`_**](./src/config/translations/pt.json) (Default), [**_`en.json`_**](./src/config/translations/en.json) e [**_`es.json`_**](./src/config/translations/es.json). **Sempre use grep ou busca global para garantir que a chave exista ou que seja criada nos 3 arquivos**.

**Convenção de nomes de chaves:** Use **apenas `.`** como separador nas chaves de tradução. Nunca use `-`, `_` ou outros caracteres de rota. Processos internos como o `PageBreadcrumb` convertem caracteres de rota (ex: `-`) para `.` antes de buscar a chave de tradução, portanto chaves que usam `-` não serão encontradas.

```
# CORRETO
"distance.more.than": "Distance greater than (nm)"
"service.order": "Service Order"

# PROIBIDO — não será encontrada pelo breadcrumb/card
"distance-more-than": "..."
"service_order": "..."
```

Exemplo de uso:

```tsx
import { useTranslation } from "react-i18next";

function MyComponent() {
  const { t } = useTranslation();

  return (
    <div>
      {/* No JSX */}
      <h1>{t("welcome.title")}</h1>

      {/* Com Variáveis (Use chaves simples { }) */}
      <p>{t("welcome.message", { name: "User" })}</p>

      {/* Em Atributos/Placeholders */}
      <Input placeholder={t("login.email.placeholder")} />
    </div>
  );
}
```

### Roteamento

As rotas são baseadas em **diretórios**. Cada pasta de rota (inclusive sub-rotas como "add" ou "details") deve conter obrigatoriamente um arquivo `index.tsx` com a estrutura principal. É proibido o uso do caractere `.` para criar rotas aninhadas e do `$` para capturar parâmetros (ex: `$id`). Todos os fluxos dinâmicos como IDs de registro devem usar **Search Params** (`useSearch()` do routing). Isso garante a integridade e escalabilidade funcional do `Breadcrumb` e da `Sidebar`.

| Arquivo                    | Rota Gerada | Descrição / Regra                                                           |
| :------------------------- | :---------- | :-------------------------------------------------------------------------- |
| `index.tsx`                | `/`         | Define a página raiz do diretório.                                          |
| `add/index.tsx`            | `/add`      | Rota em um subdiretório para criação de novos registros.                    |
| `details/index.tsx`        | `/details`  | Rota para visualização de detalhes. IDs recuperados usando o Search Params. |
| `$id.tsx` / `edit.$id.tsx` | —           | **NÃO UTILIZAR.** (Proibido o uso de `$` e `.` em arquivos).                |

### Tratamento de Data

Toda formatação de data para exibição em tela deve ser feita obrigatoriamente através da função utilitária [**_`@/lib/formatDate`_**](./src/lib/formatDate.ts). Ela garante a internacionalização correta baseada no idioma selecionado.

- **Funções**: `formatDate(date, pattern)` e `formatDistanceToNow(date, options)`.
- **Evite**: Importar `format` ou `formatDistanceToNow` diretamente do `date-fns` em componentes, pois isso ignora o locale do sistema.

### Gerenciamento de Estado

Utilize **Zustand** para estados globais complexos. Não utilize `localStorage.setItem` diretamente. Utilize o middleware `persist` do Zustand para persistência de dados.

**Quando usar cada ferramenta:**

| Tipo | Ferramenta | Exemplo |
|------|------------|---------|
| Server State | TanStack Query | Lista de usuários, detalhes |
| Form State | react-hook-form | Campos de formulário |
| UI Local | useState | Modal aberto, tab ativa |
| UI Global | Zustand | Sidebar, tema, filtro global |
| Persistente | Zustand + persist | Token, preferências |

**Stores globais disponíveis:**

| Hook | Propósito |
|------|-----------|
| `useAuth` | Token JWT, usuário, login |
| `useEnterpriseFilter` | Empresa selecionada globalmente (`idEnterprise`) |
| `usePermissions` | Cache de permissões do usuário |
| `useFavorites` | Links favoritos |
| `useSidebar` | Estado expandido/colapsado |

**Anti-patterns de Estado:**
- NUNCA `localStorage.setItem` direto — usar Zustand persist
- NUNCA `useEffect` para sincronizar estado derivado — usar `useMemo`
- NUNCA `fetch` em `useEffect` — usar TanStack Query

---

## Componentes Obrigatórios

- **Estados Vazios**: Caso não haja dados ou o retorno de filtros e buscas seja vazio (`data.length === 0`), utilize obrigatoriamente o componente [**_`default-empty-data.tsx`_**](./src/components/default-empty-data.tsx).

- **Estado de Loading**: Em caso de requisições pendentes, utilize obrigatoriamente o componente de skeleton [**_`DefaultLoading`_**](./src/components/default-loading.tsx).

- **Layout de Formulário**: Utilize o componente [**_`DefaultFormLayout`_**](./src/components/default-form-layout.tsx) como padrão base para garantir a consistência visual em telas de cadastro ou edição.

---

## Padrões React

### Declaração de Componentes

**SEMPRE** use `function` declarations:

```tsx
// CORRETO
function UserCard({ user }: UserCardProps) {
  return (
    <Item>
      <ItemTitle>{user.name}</ItemTitle>
      <ItemDescription>{user.email}</ItemDescription>
    </Item>
  );
}

// EVITAR
const UserCard = ({ user }: UserCardProps) => { ... };
const UserCard: React.FC<UserCardProps> = ({ user }) => { ... };
```

### Ordem Interna do Componente

```tsx
function MyComponent({ prop1 }: MyComponentProps) {
  // 1. Hooks de contexto/router
  const { t } = useTranslation();
  const navigate = Route.useNavigate();

  // 2. Hooks de estado global (Zustand)
  const { idEnterprise } = useEnterpriseFilter();

  // 3. Hooks de dados (TanStack Query)
  const { data, isLoading } = useUsers();

  // 4. Estado local
  const [isOpen, setIsOpen] = useState(false);

  // 5. Valores derivados / useMemo
  const filteredUsers = useMemo(() => data?.filter(u => u.active), [data]);

  // 6. Callbacks
  const handleSelect = useCallback((user: User) => { ... }, []);

  // 7. Effects (usar com moderação)

  // 8. Early returns (loading → error → empty → success)
  if (isLoading) return <DefaultLoading />;
  if (!data?.length) return <DefaultEmptyData />;

  // 9. Render
  return ( ... );
}
```

### Classes Condicionais

```tsx
import { cn } from '@/lib/utils';

className={cn(
  'rounded-md font-medium',
  variant === 'primary' && 'bg-primary text-white',
  variant === 'outline' && 'border border-input bg-transparent',
  className
)}
```

---

## Modelos de Exibição de Dados (Gráficos, Tabelas e Números)

Estes arquivos servem de modelos a serem seguidos e **não devem ser importados**.

- [**_`GraphArea`_**](./src/components/graph-area.tsx): Modelo para gráfico de área.
- [**_`GraphBarStacked`_**](./src/components/graph-bar-stacked.tsx): Modelo para gráfico de barras e barras sobrepostas.
- [**_`GraphBreakParts`_**](./src/components/graph-break-parts.tsx): Modelo para gráfico de treemap e distribuição de total.
- [**_`GraphLines`_**](./src/components/graph-lines.tsx): Modelo para gráfico de linhas.
- [**_`GraphPizza`_**](./src/components/graph-pizza.tsx): Modelo para gráfico de pizza.
- [**_`GraphProgress`_**](./src/components/graph-progress.tsx): Modelo para gráfico de progresso do total.
- [**_`GraphRadial`_**](./src/components/graph-radial.tsx): Modelo para gráfico radial.
- [**_`DefaultKPI`_**](./src/components/default-KPI.tsx): Modelo para exibição de números e KPIs.
- [**_`DefaultTable`_**](./src/components/default-table.tsx): Modelo para tabelas com paginação e filtros.

**Dicas para Gráficos**:
- **NÃO use `mx-auto`** no `ChartContainer` (gera bugs no `ResponsiveContainer`).
- Use `getChartColor(index)` para mapear cores dinâmicas.
- Multiplique o index por 2 ou 3 para maior contraste: `getChartColor(index * 3)`.
- Gráficos são componentes comuns: usar `Item`, `ItemTitle` — nunca `Card`.
- Utilize `aspect-square` ou `max-h-[XXXpx]` para controlar o tamanho.

---

## Hook de API (Padrão)

Utilize o `TanStack Query` com chaves centralizadas.

```tsx
// src/hooks/use-users-api.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

// Query keys centralizadas
export const usersKeys = {
  all: ["users"] as const,
  lists: () => [...usersKeys.all, "list"] as const,
  list: (filters?: Record<string, unknown>) => [...usersKeys.lists(), filters] as const,
  details: () => [...usersKeys.all, "detail"] as const,
  detail: (id: string) => [...usersKeys.details(), id] as const,
};

// Hook de Query
export function useUsers() {
  return useQuery({
    queryKey: usersKeys.lists(),
    queryFn: async () => {
      const response = await api.get("/user/list");
      return response.data;
    },
  });
}

// Hook de Mutations
export function useUsersApi() {
  const queryClient = useQueryClient();

  const createUser = useMutation({
    mutationFn: (data) => api.post("/user", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKeys.lists() }),
  });

  return { createUser };
}
```

---

## Hook de Formulário (Padrão)

Utilize o `react-hook-form` com `zod` para validação.

```tsx
// src/routes/_private/users/@hooks/use-user-form.ts
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useUsersApi } from "@/hooks/use-users-api";
import { userFormSchema, type UserFormData } from "../@interface/user";

export function useUserForm(initialData?: UserFormData) {
  const { createUser, updateUser } = useUsersApi();

  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: initialData,
  });

  const onSubmit = form.handleSubmit(async (data) => {
    if (initialData?.id) {
      await updateUser.mutateAsync(data);
    } else {
      await createUser.mutateAsync(data);
    }
  });

  return { form, onSubmit, isPending: createUser.isPending || updateUser.isPending };
}
```

---

## Criação e Reutilização de Hooks

**Antes de criar qualquer hook** na pasta `@hooks/` da rota, verifique se já existe na pasta de hooks compartilhados em [**_`src/hooks/`_**](./src/hooks/).

**Árvore de Decisão**:

```markdown
Preciso de `useCustomers()` para listar clientes?
└─ Já existe em `src/hooks/use-customers-api.ts`?
   ├─ **SIM** → `import { useCustomersApi } from '@/hooks/use-customers-api'`
   └─ **NÃO** → Criar em `src/hooks/use-{entidade}-api.ts` (reutilizável)

Preciso de `useCustomerForm()` para gerenciar formulário de cliente?
└─ É específico da rota de edição/criação?
   ├─ **SIM** → Criar em `@hooks/use-customer-form.ts`
   └─ **NÃO** → Avaliar se deve ir em `src/hooks/`
```

**Hooks Globais disponíveis em `src/hooks`:**

| Hook | Descrição |
|------|-----------|
| `useEnterpriseFilter` | idEnterprise do filtro global (workspace/tenant) |
| `useHasPermission` / `useHasPermissions` | Verifica permissões do usuário |
| `useAuth` | Sessão, token JWT e login |
| `useSidebarMenus` / `useSidebarToggle` | Estado da sidebar |
| `useIsMobile` | Detecta dispositivo mobile |
| `useEnterprisesSelect` | Empresas para select |
| `useUsersApi` / `useRolesApi` | CRUD usuários / roles (RBAC) |
| `useCustomersApi` (exemplo) | CRUD do módulo de exemplo `customers` |
| `useLocale` | Idioma ativo (i18n) |
| `useFavorites` | Links favoritos |

Use `useCustomersApi` e a rota `register/customers/` como referência de como criar um novo hook/módulo de API.

---

## Criação de Página

### Hub de Módulo (Roteadora)

Todo módulo possui um `index.tsx` na raiz que funciona como **hub de navegação**: lista cards com links para todas as sub-rotas do módulo.

**Regra obrigatória:** Ao criar uma nova sub-rota em um módulo existente, o `index.tsx` hub do módulo **deve** ser atualizado com o novo item de menu. Ao criar um módulo do zero, o hub deve ser criado antes das sub-páginas.

```
src/routes/_private/{modulo}/
├── index.tsx          ← HUB — criar/atualizar sempre
├── sub-feature-a/
│   └── index.tsx
└── nova-feature/
    └── index.tsx      ← nova sub-rota
```

O hub usa `staticData` obrigatório (alimenta busca de rotas por IA) e lista todos os itens de menu com `Link`:

```tsx
export const Route = createFileRoute('/_private/{modulo}/')({
  staticData: {
    title: 'modulo.title',
    description: 'Descricao do hub.',
    tags: ['modulo', 'tag'],
    relatedRoutes: [
      { path: '/_private/{modulo}/sub-feature-a', relation: 'child', description: '...' },
      // Ao adicionar nova sub-rota, incluir entrada aqui
    ],
    capabilities: ['Navegar para sub-feature A'],
  },
  component: ModuloHubPage,
});

function ModuloHubPage() {
  const { t } = useTranslation();

  const menuItems = [
    { title: t('sub.feature.a'), description: t('sub.feature.a.description'), icon: BarChart2, to: '/{modulo}/sub-feature-a' as const },
    // Ao adicionar nova sub-rota, incluir item aqui
  ];

  return (
    <Card>
      <CardHeader />
      <CardContent className="grid gap-4 md:grid-cols-2">
        {menuItems.map((item) => (
          <Item key={item.to} variant="outline" className="h-full cursor-pointer" asChild>
            <Link to={item.to}>
              <ItemMedia variant="icon"><item.icon className="size-5" /></ItemMedia>
              <ItemContent>
                <ItemTitle className="text-base">{item.title}</ItemTitle>
                <ItemDescription>{item.description}</ItemDescription>
              </ItemContent>
            </Link>
          </Item>
        ))}
      </CardContent>
    </Card>
  );
}
```

> O hub **não** usa `CardFooter` nem paginação. Ao adicionar uma sub-rota, atualizar `relatedRoutes`, `capabilities` e `menuItems` simultaneamente.

---

**1. Definição da Rota**

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_private/permissions/users/")({
  component: ListUsersPage,
});
```

**Com validação de Search Params (Opcional):**

```tsx
import { z } from "zod";

const searchSchema = z.object({
  id: z.string().optional(),
  filter: z.string().optional(),
});

export const Route = createFileRoute("/_private/machine-list/")({
  component: MachineListPage,
  validateSearch: searchSchema,
});

// Dentro do componente:
const { id, filter } = useSearch({ from: "/_private/machine-list/" });
```

**2. Estrutura da Página (Componente)**

- Páginas ( _definidas pelo uso de `createFileRoute`_ ): Devem obrigatoriamente iniciar com `<Card>` seguido de `<CardHeader>` como estrutura principal.

- Componentes Comuns: Não podem utilizar componentes de [~~`Card.tsx`~~](./src/components/ui/card.tsx). Devem utilizar exclusivamente as opções de [**_`Item.tsx`_**](./src/components/ui/item.tsx).
  - **Tipagem Padrão**: Toda tipagem de texto comum deve ser feita através dos componentes `<ItemTitle />` e `<ItemDescription />`.

1. [**_`Card`_**](./src/components/ui/card.tsx): **OBRIGATÓRIO** Atua como `Shell/Wrapper` principal de página. **Toda rota** deve ser encapsulada por este componente.

2. [**_`CardHeader`_**](./src/components/ui/card.tsx): **OBRIGATÓRIO** Cabeçalho padrão. Ele recebe como atributo `title` e parametro `children` para elementos de ação (botões, filtros, busca).

3. [**_`ItemTitle` e `ItemDescription`_**](./src/components/ui/item.tsx): Componentes padrão para títulos e descrições de itens. Devem ser usados em listas, tabelas e detalhes.

Exemplo:

```tsx
import { useTranslation } from "react-i18next";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_private/rota-da-pagina/")({
  component: MinhaPagina,
});

export function MinhaPagina() {
  const { t } = useTranslation();
  const navigate = Route.useNavigate();

  return (
    <Card>
      <CardHeader title={t("meu.modulo.titulo")}>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Filter className="size-4" />
            {t("filter")}
          </Button>
          <Button
            onClick={() => {
              navigate({ to: "/add" } satisfies { to: string });
            }}
          >
            <Plus className="size-4" />
            {t("btn.novo")}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <Item>{/* Conteúdo da página */}</Item>
      </CardContent>

      <CardFooter layout="multi | single">{/* Ações e paginação */}</CardFooter>
    </Card>
  );
}
```

---

## Organização de Rotas e Pastas

As subpastas `@hooks`, `@interface`, `@components`, `@consts` e `@utils` devem ser criadas na pasta da rota, elas seguem o seguinte propósito:

| Pasta          | Conteúdo                            | Quando Usar                                                                |
| -------------- | ----------------------------------- | -------------------------------------------------------------------------- |
| `@components/` | Componentes React                   | Elementos visuais utilizados exclusivamente nesta rota.                    |
| `@consts/`     | Arrays, objetos, enums              | Valores `hardcoded` ou que não mudam em runtime.                           |
| `@hooks/`      | Hooks de API e lógica de formulário | Lógica de formulários (useForm) ou queries/mutations de API específicas.   |
| `@interface/`  | Types, Interfaces, Schemas Zod      | Tipagens TypeScript (Interfaces/Types) e Schemas de validação (Zod).       |
| `@utils/`      | Funções puras e auxiliares          | Lógica de processamento de dados que não depende de estado React ou hooks. |

```markdown
src/routes/_private/{module}/
├── index.tsx                   # Página principal da rota
│
├── {subroute}/                 # Outra pasta
│   ├── @components/            # Componentes específicos da rota
│   │   └── {ComponentName}.tsx
│   │
│   ├── @consts/                # Valores fixos, enums
│   │   └── {feature}.consts.ts
│   │
│   ├── @hooks/                 # Hooks específicos da rota
│   │   ├── use-{feature}-form.ts
│   │   └── use-{feature}-api.ts
│   │
│   ├── @interface/             # Tipos, Interfaces, Schemas Zod
│   │   ├── {feature}.types.ts
│   │   └── {feature}.schema.ts
│   │
│   ├── @utils/                 # Funções auxiliares e processamento
│   │   └── {feature}.utils.ts
│   │
│   └── index.tsx               # Página da subrota
```

---

## Seletores de Dados (Selects)

[**_`src/components/selects`_**](./src/components/selects) — os componentes de seleção de dados do sistema encapsulam a lógica de requisição a API, seu loading e tratamento de erro, já estilizados com label e ícone seguindo o padrão do sistema.

**Disponíveis no template:**

| Componente         | Descrição                             |
| :------------------ | :------------------------------------- |
| `EnterpriseSelect`  | Seleção de empresas (filtro global)    |
| `UserSelect`        | Seleção de usuários                    |
| `RoleSelect`        | Seleção de roles (RBAC)                |
| `UserRoleSelect`    | Seleção de role no contexto de usuário |
| `CountrySelect`     | Seleção de país                        |
| `CustomerSelect`    | Exemplo de select de entidade de negócio (módulo `customers`) |

Use `CustomerSelect` como referência ao criar um novo select para uma nova entidade.

_(Verifique o diretório antes de criar um novo select)_

Recebem como props:

- `mode`: `'single' | 'multi'` (Define se é seleção única ou múltipla).
- `value`: `string | string[]`
- `onChange`: `(value) => void`
- `label?`: `string` (Evitar o uso)
- `placeholder?`: `string` (Evitar o uso)
- `disabled?`: `boolean`
- `clearable?`: `boolean`

---

## Anti-Patterns Proibidos

- `localStorage.setItem` direto → usar Zustand persist
- `useEffect` para estado derivado → usar `useMemo`
- `fetch` em `useEffect` → usar TanStack Query
- Importar `format` do `date-fns` → usar `@/lib/formatDate`
- Props drilling por 3+ níveis → usar Zustand ou Context
- Criar hook sem verificar se já existe em `src/hooks/`
- Strings hardcoded em UI → usar `t('chave')` i18n
- Usar `Card` em componentes comuns → usar `Item`
- Usar `mx-auto` no `ChartContainer`
- Usar `.` ou `$` em nomes de arquivos de rota
- Criar uma nova sub-rota sem atualizar o `index.tsx` hub do módulo pai
- Criar um módulo novo sem o `index.tsx` hub listando todas as sub-rotas

---

## Ferramentas de Produtividade

**Inlang (Sherlock)** para gerenciar traduções diretamente no `VS Code`.

- **Hover**: Passe o mouse sobre uma chave `t("key")` para ver a tradução.
- **Extração**: Selecione um texto hardcoded e use `Cmd + .` para extrair para uma chave `i18n` automaticamente.
- **Lint**: Alertas automáticos para chaves faltando ou traduções idênticas.

**Biome** para formatação de código. Antes de fazer commits rode `pnpm run format`.

**TypeScript** para tipagem de código. Antes de fazer commits rode `pnpm run check`.

**Tailwind CSS intellisense** para ter as classes disponíveis. Clique `Ctrl + Espaço` (Windows) ou `Cmd + Espaço` (Mac) para ver as opções disponíveis estando o cursor dentro de uma `className=""`.
