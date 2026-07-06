# Recursos Disponiveis no Projeto

Antes de criar qualquer hook ou componente de select, verifique se ja existe. O projeto possui um inventario extenso de recursos reutilizaveis.

## Componentes de Select (68 em `src/components/selects/`)

Ja encapsulam API, loading e erro. Use-os em vez de criar selects do zero.

```tsx
import { EnterpriseSelect, MachineByEnterpriseSelect, UserSelect } from '@/components/selects';

// Single select
<EnterpriseSelect mode="single" value={idEnterprise} onChange={setIdEnterprise} />

// Multi select
<MachineByEnterpriseSelect
  mode="multi"
  idEnterprise={idEnterprise}
  value={selectedMachines}
  onChange={setSelectedMachines}
/>
```

**Props padrao:** `mode`, `value`, `onChange`, `disabled?`, `clearable?`, `label?`, `placeholder?`

**TOP 10 mais usados:**

| Componente | Usos |
|------------|------|
| `MachineByEnterpriseSelect` | 28 |
| `EnterpriseSelect` | 27 |
| `MachineSelect` | 9 |
| `UserSelect` | 8 |
| `UnitSelect` | 5 |
| `SensorByMachineSelect` | 5 |
| `MaintenancePlanSelect` | 4 |
| `CustomerSelect` | 4 |
| `ConsumptionMachineSelect` | 4 |
| `ModelMachineSelect` | 4 |

Para ver todos os selects disponiveis, rode: `ls src/components/selects/`

## Hooks Globais (258 em `src/hooks/`)

**TOP 15 mais usados:**

| Hook | Usos | Descricao |
|------|------|-----------|
| `useEnterpriseFilter` | 90 | idEnterprise do filtro global |
| `useHasPermission` | 35 | Verifica permissoes do usuario |
| `useSidebar` | 7 | Estado da sidebar |
| `useSidebarToggle` | 7 | Toggle da sidebar |
| `useCMMSKPIs` | 6 | KPIs do CMMS |
| `useIsMobile` | 5 | Detecta dispositivo mobile |
| `useMachinesByEnterpriseSelect` | 5 | Maquinas por empresa |
| `useEnterprisesSelect` | 4 | Empresas para select |
| `useUsersApi` | 4 | CRUD usuarios |
| `usePartsApi` | 3 | CRUD pecas |
| `useModelMachinesApi` | 3 | CRUD modelos |
| `usePlatformsApi` | 3 | CRUD plataformas |
| `useAuth` | 3 | Sessao e login |
| `useSensorsApi` | 3 | CRUD sensores |
| `useMachinesApi` | 3 | CRUD maquinas |

Para ver todos os hooks disponiveis, rode: `ls src/hooks/`

## Componentes Obrigatorios

| Componente | Import | Uso |
|------------|--------|-----|
| `DefaultEmptyData` | `@/components/default-empty-data` | Dados vazios |
| `DefaultLoading` | `@/components/default-loading` | Loading |
| `DefaultFormLayout` | `@/components/default-form-layout` | Layout de formularios |

## Componentes de UI

- **Paginas**: Usar `Card`, `CardHeader`, `CardContent`, `CardFooter`
- **Componentes comuns**: Nunca Card. Usar `Item`, `ItemTitle`, `ItemDescription` de `@/components/ui/item`
- **Charts**: `getChartColor(index)` de `src/components/ui/chart`. Nunca `mx-auto` no ChartContainer

## Modelos de Exibicao de Dados

Estes arquivos em `src/components/` servem como referencia de implementacao (nao importar diretamente):

| Modelo | Arquivo | Descricao |
|--------|---------|-----------|
| Area | `graph-area.tsx` | Grafico de area com gradiente |
| Barras | `graph-bar-stacked.tsx` | Barras verticais e sobrepostas |
| Breakdown | `graph-break-parts.tsx` | Treemap / distribuicao de total |
| Linhas | `graph-lines.tsx` | Grafico de linhas |
| Pizza | `graph-pizza.tsx` | Pizza / donut |
| Progresso | `graph-progress.tsx` | Barra de progresso |
| Radial | `graph-radial.tsx` | Grafico radial |
| KPI | `default-KPI.tsx` | Exibicao de numeros e KPIs |
| Tabela | `default-table.tsx` | Tabela com paginacao e filtros |
