# Graficos (Recharts)

## Indice

1. [Regras Criticas](#regras-criticas)
2. [Cores — getChartColor](#cores--getchartcolorindex)
3. [Estrutura Padrao](#estrutura-padrao-de-um-grafico)
4. [Tipos de Grafico](#tipos-de-grafico-disponiveis)
5. [Dicas de Layout](#dicas-de-tamanho-e-layout)
6. [ChartConfig](#chartconfig--padrao-de-configuracao)

## Regras Criticas

- Nunca use `mx-auto` no `ChartContainer` — quebra o `ResponsiveContainer` interno
- Sempre use `getChartColor(index)` de `@/components/ui/chart` para cores
- Os arquivos `src/components/graph-*.tsx` sao modelos de referencia — nao devem ser importados
- Graficos ficam dentro de componentes comuns: use `Item`, `ItemTitle`, `ItemDescription` — nunca `Card`

## Cores — `getChartColor(index)`

```tsx
import { getChartColor } from '@/components/ui/chart';

getChartColor(0);  // var(--color-sky-400)
getChartColor(1);  // var(--color-blue-400)
getChartColor(3);  // var(--color-violet-400)
```

### Como funciona

Cicla sobre 17 cores do Tailwind e incrementa o tom a cada ciclo:

```
Cores: sky, blue, indigo, violet, purple, fuchsia, pink, rose, red, orange, amber, yellow, lime, green, emerald, teal, cyan
Tons:  400 → 500 → 600 → ...
```

- `index 0-16` → tom 400
- `index 17-33` → tom 500

### Maior diferenciacao de cores

Multiplique o index por 2 ou 3 para mais contraste:

```tsx
getChartColor(0 * 3); // sky-400
getChartColor(1 * 3); // violet-400
getChartColor(2 * 3); // pink-400
```

## Componentes do ShadCN Chart

Todos exportados de `@/components/ui/chart`:

| Componente | Uso |
|---|---|
| `ChartContainer` | Wrapper obrigatorio. Recebe `config` (ChartConfig) |
| `ChartConfig` | Type para o objeto de configuracao |
| `ChartTooltip` | Re-export do Tooltip do Recharts |
| `ChartTooltipContent` | Conteudo estilizado para tooltip |
| `ChartLegend` | Re-export do Legend do Recharts |
| `ChartLegendContent` | Conteudo estilizado para legenda |

## Estrutura Padrao de um Grafico

```tsx
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  getChartColor,
} from '@/components/ui/chart';
import { Item, ItemContent, ItemDescription, ItemHeader, ItemTitle } from '@/components/ui/item';

const chartConfig = {
  desktop: {
    label: 'Desktop',
    color: getChartColor(0),
  },
  mobile: {
    label: 'Mobile',
    color: getChartColor(3),
  },
} satisfies ChartConfig;

function MyChart() {
  return (
    <Item variant="outline">
      <ItemHeader className="flex-col items-center justify-center">
        <ItemTitle>Titulo do Grafico</ItemTitle>
        <ItemDescription>Descricao</ItemDescription>
      </ItemHeader>
      <ItemContent>
        <ChartContainer config={chartConfig}>
          <BarChart data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="desktop" fill={getChartColor(0)} radius={4} />
            <Bar dataKey="mobile" fill={getChartColor(3)} radius={4} />
          </BarChart>
        </ChartContainer>
      </ItemContent>
    </Item>
  );
}
```

## Tipos de Grafico Disponiveis

Modelos de referencia em `src/components/`:

### Barras — `graph-bar-stacked.tsx`

```tsx
<Bar dataKey="desktop" stackId="a" fill={getChartColor(0)} radius={[0, 0, 4, 4]} />
<Bar dataKey="mobile" stackId="a" fill={getChartColor(1)} radius={[4, 4, 0, 0]} />
```

### Barras Horizontais

Usa `layout="vertical"` no `BarChart` com cores individuais via fill nos dados.

### Linhas — `graph-lines.tsx`

```tsx
<Line dataKey="desktop" type="monotone" stroke={getChartColor(0)} strokeWidth={2} dot={false} />
```

### Area — `graph-area.tsx`

Usa `linearGradient` no `defs` para gradiente:

```tsx
<defs>
  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
    <stop offset="95%" stopColor={color} stopOpacity={0} />
  </linearGradient>
</defs>
<Area dataKey={name} stroke={color} fill={`url(#${gradientId})`} fillOpacity={0.4} type="monotone" />
```

### Pizza (Donut) — `graph-pizza.tsx`

```tsx
const chartData = data.map((item, index) => ({
  ...item,
  fill: getChartColor(index),
}));

<Pie data={chartData} dataKey="visitors" nameKey="browser" innerRadius={60} strokeWidth={5}>
  <Label content={({ viewBox }) => { /* label central */ }} />
</Pie>
```

### Radial — `graph-radial.tsx`

```tsx
<RadialBarChart data={chartData} endAngle={100} innerRadius={80} outerRadius={140}>
  <PolarGrid gridType="circle" radialLines={false} stroke="none" />
  <RadialBar dataKey="visitors" background />
</RadialBarChart>
```

### Breakdown (Partes) — `graph-break-parts.tsx`

Barra horizontal segmentada. Implementacao customizada com divs. Use `getChartColor(index * 3)` para contraste.

### Progresso — `graph-progress.tsx`

Usa o componente `Progress` do ShadCN: `<Progress value={percentage} className="h-6" />`

## Dicas de Tamanho e Layout

```tsx
// Pizza/radial
<ChartContainer config={config} className="aspect-square max-h-80">

// Area/linhas/barras
<ChartContainer config={config} className="h-full w-full">

// Altura fixa em container pai
<div className="h-16">
  <ChartContainer config={config} className="h-full w-full">
```

## ChartConfig — Padrao de Configuracao

```tsx
const chartConfig = {
  // Chave generica (sem cor, apenas label para tooltip)
  visitors: {
    label: 'Visitors',
  },
  // Chave com cor fixa
  chrome: {
    label: 'Chrome',
    color: getChartColor(0),
  },
  // Chave com tema (dark/light)
  safari: {
    label: 'Safari',
    theme: {
      light: getChartColor(3),
      dark: getChartColor(6),
    },
  },
} satisfies ChartConfig;
```
