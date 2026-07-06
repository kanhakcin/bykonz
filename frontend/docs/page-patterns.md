# Padroes de Pagina

## Indice

1. [Estrutura Obrigatoria](#estrutura-obrigatoria)
2. [Pagina Hub (Roteadora de Modulo)](#pagina-hub-roteadora-de-modulo)
3. [Pagina de Listagem](#pagina-de-listagem-exemplo-completo)
4. [Pagina de Formulario](#pagina-de-formulario-exemplo-completo)

## Estrutura Obrigatoria

Toda pagina definida por `createFileRoute` segue esta estrutura:

```tsx
<Card>
  <CardHeader title={t("titulo")}>{/* Acoes: botoes, filtros */}</CardHeader>
  <CardContent>{/* Conteudo */}</CardContent>
  <CardFooter layout="multi | single">{/* Paginacao */}</CardFooter>
</Card>
```

## Pagina Hub (Roteadora de Modulo)

O `index.tsx` de cada modulo funciona como **hub de navegacao**: apresenta cards linkando para todas as sub-rotas do modulo. Ele e a primeira pagina que o usuario ve ao entrar no modulo.

### Quando criar ou atualizar

| Situacao                                       | Acao obrigatoria                                          |
| ---------------------------------------------- | --------------------------------------------------------- |
| Criar um modulo novo do zero                   | Criar `{modulo}/index.tsx` hub antes de qualquer sub-rota |
| Adicionar uma nova sub-rota a modulo existente | Atualizar `{modulo}/index.tsx` adicionando o item de menu |
| Remover uma sub-rota                           | Remover o item correspondente do hub                      |

### Estrutura de pastas

```
src/routes/_private/{modulo}/
├── index.tsx              ← HUB — sempre criar/atualizar
├── sub-feature-a/
│   └── index.tsx
├── sub-feature-b/
│   └── index.tsx
└── nova-feature/
    └── index.tsx          ← nova sub-rota adicionada
```

### Exemplo completo de Hub Page

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart2, FileText, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";

export const Route = createFileRoute("/_private/{modulo}/")({
  staticData: {
    title: "modulo.title",
    description: "Descricao longa do hub para o sistema de IA/busca de rotas.",
    tags: ["modulo", "tag1", "tag2"],
    examplePrompts: ["Abrir o modulo X", "Ver opcoes de X"],
    searchParams: [],
    relatedRoutes: [
      { path: "/_private/{modulo}/sub-feature-a", relation: "child", description: "Descricao da sub-feature A" },
      { path: "/_private/{modulo}/sub-feature-b", relation: "child", description: "Descricao da sub-feature B" },
      // Ao adicionar nova sub-rota, incluir entrada aqui tambem
      { path: "/_private/{modulo}/nova-feature", relation: "child", description: "Descricao da nova feature" },
    ],
    entities: ["EntidadePrincipal"],
    capabilities: ["Navegar para sub-feature A", "Navegar para sub-feature B", "Navegar para nova feature"],
  },
  component: ModuloHubPage,
});

function ModuloHubPage() {
  const { t } = useTranslation();

  const menuItems = [
    {
      title: t("sub.feature.a"),
      description: t("sub.feature.a.description"),
      icon: BarChart2,
      to: "/{modulo}/sub-feature-a" as const,
    },
    {
      title: t("sub.feature.b"),
      description: t("sub.feature.b.description"),
      icon: FileText,
      to: "/{modulo}/sub-feature-b" as const,
    },
    // Ao adicionar nova sub-rota, incluir item aqui
    {
      title: t("nova.feature"),
      description: t("nova.feature.description"),
      icon: TrendingUp,
      to: "/{modulo}/nova-feature" as const,
    },
  ];

  return (
    <Card>
      <CardHeader />
      <CardContent className="grid gap-4 md:grid-cols-2">
        {menuItems.map((item) => (
          <Item key={item.to} variant="outline" className="h-full cursor-pointer" asChild>
            <Link to={item.to}>
              <ItemMedia variant="icon">
                <item.icon className="size-5" />
              </ItemMedia>
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

### Notas

- O hub **nao** usa `CardFooter` nem paginacao — e apenas navegacao
- `staticData` e obrigatorio no hub: alimenta o sistema de busca de rotas por IA
- Ao adicionar uma nova sub-rota, atualizar `relatedRoutes`, `capabilities` e `menuItems` simultaneamente
- As chaves i18n do titulo e descricao de cada item devem existir nos 3 arquivos de traducao — antes de criar, faca grep por conceito (ver [`i18n.md`](./i18n.md))

## Pagina de Listagem (Exemplo Completo)

```tsx
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Plus, Search, MoreVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import DefaultEmptyData from "@/components/default-empty-data";
import DefaultLoading from "@/components/default-loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useEnterpriseFilter } from "@/hooks/use-enterprise-filter";
import { useFeatures, useFeaturesApi } from "@/hooks/use-features-api";

// 1. Schema de validacao dos search params
const searchSchema = z.object({
  page: z.number().optional().default(1),
  size: z.number().optional().default(20),
  search: z.string().optional(),
});

type SearchParams = z.infer<typeof searchSchema>;

// 2. Definicao da rota
export const Route = createFileRoute("/_private/register/features/")({
  component: FeatureListPage,
  validateSearch: (search: Record<string, unknown>): SearchParams => searchSchema.parse(search),
});

// 3. Componente da pagina
function FeatureListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate({ from: Route.fullPath });
  const { page, size, search } = useSearch({ from: "/_private/register/features/" });
  const { idEnterprise } = useEnterpriseFilter();

  // 4. Fetch de dados
  const { data, isLoading } = useFeatures({
    idEnterprise,
    page: page - 1,
    size,
    search,
  });
  const { deleteFeature } = useFeaturesApi();

  const items = data?.data || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / size);

  // 5. Handlers
  const handleDelete = async (id: string) => {
    try {
      await deleteFeature.mutateAsync(id);
      toast.success(t("delete.success"));
    } catch {
      toast.error(t("error.delete"));
    }
  };

  // 6. Render com estrutura obrigatoria
  return (
    <Card>
      <CardHeader title={t("features")}>
        <div className="flex w-full flex-col items-center gap-4 sm:w-auto sm:flex-row">
          <div className="relative w-full sm:max-w-64">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("search")}
              className="pl-8"
              defaultValue={search || ""}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  navigate({
                    search: (prev: SearchParams) => ({
                      ...prev,
                      search: e.currentTarget.value || undefined,
                      page: 1,
                    }),
                  });
                }
              }}
            />
          </div>
          <Button onClick={() => navigate({ to: "/register/features/add" })}>
            <Plus className="size-4" />
            {t("add")}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <DefaultLoading />
        ) : items.length === 0 ? (
          <DefaultEmptyData />
        ) : (
          <ItemGroup>
            {items.map((item) => (
              <Item key={item.id} variant="outline" className="cursor-pointer" onClick={() => navigate({ to: "/register/features/add", search: { id: item.id } })}>
                <div className="flex flex-1 items-center gap-4">
                  <ItemContent className="gap-0">
                    <ItemTitle className="text-base">{item.description}</ItemTitle>
                    <ItemDescription>{item.code}</ItemDescription>
                  </ItemContent>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate({ to: "/register/features/add", search: { id: item.id } })}>{t("edit")}</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(item.id)}>
                      {t("delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </Item>
            ))}
          </ItemGroup>
        )}
      </CardContent>

      {totalCount > 0 && (
        <CardFooter layout="multi">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <span>{t("show")}</span>
            <Select value={String(size)} onValueChange={(val) => navigate({ search: (prev: SearchParams) => ({ ...prev, size: Number(val), page: 1 }) })}>
              <SelectTrigger className="h-8 w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <span>{t("per.page")}</span>
            <span className="ml-4 tabular-nums">
              {t("total")}: {totalCount}
            </span>
          </div>

          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => page > 1 && navigate({ search: (prev: SearchParams) => ({ ...prev, page: page - 1 }) })}
                  className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  onClick={() => page < totalPages && navigate({ search: (prev: SearchParams) => ({ ...prev, page: page + 1 }) })}
                  className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </CardFooter>
      )}
    </Card>
  );
}
```

## Pagina de Formulario (Exemplo Completo)

```tsx
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import DefaultLoading from "@/components/default-loading";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";

import { useFeature, useFeaturesApi } from "@/hooks/use-features-api";
import { FeatureForm } from "./@components/feature-form";
import { useFeatureForm } from "./@hooks/use-feature-form";

const searchSchema = z.object({
  id: z.string().optional(),
});

export const Route = createFileRoute("/_private/register/features/add")({
  component: FeatureAddPage,
  validateSearch: searchSchema,
});

function FeatureAddPage() {
  const { t } = useTranslation();
  const { id } = useSearch({ from: "/_private/register/features/add" });
  const { data: feature, isLoading } = useFeature(id);

  if (id && isLoading) {
    return (
      <Card>
        <CardHeader />
        <CardContent className="p-12">
          <DefaultLoading />
        </CardContent>
      </Card>
    );
  }

  return <FeatureAddFormContent initialData={feature} />;
}

function FeatureAddFormContent({ initialData }: { initialData?: any }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { deleteFeature } = useFeaturesApi();

  const formData = useMemo(() => {
    if (!initialData) return undefined;
    return {
      id: initialData.id,
      idEnterprise: initialData.idEnterprise,
      // ... mapear campos
    };
  }, [initialData]);

  const { form, onSubmit, isPending } = useFeatureForm(formData);

  const handleDelete = async () => {
    if (!initialData?.id) return;
    try {
      await deleteFeature.mutateAsync(initialData.id);
      toast.success(t("delete.success"));
      navigate({ to: "/register/features" });
    } catch {
      toast.error(t("error.delete"));
    }
  };

  return (
    <Card>
      <CardHeader />
      <Form {...form}>
        <form onSubmit={onSubmit}>
          <CardContent>
            <FeatureForm />
          </CardContent>
          <CardFooter>
            {initialData && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" disabled={deleteFeature.isPending || isPending}>
                    {deleteFeature.isPending ? <Spinner className="size-4" /> : <Trash2 className="size-4" />}
                    {t("delete")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("delete.confirmation")}</AlertDialogTitle>
                    <AlertDialogDescription>{t("delete.message.default")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                    <AlertDialogAction variant={"destructive"} onClick={handleDelete}>
                      <Trash2 className="size-4" />
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button type="submit" disabled={isPending} className="ml-auto min-w-30">
              {isPending && <Spinner className="size-4" />}
              {t("save")}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
```
