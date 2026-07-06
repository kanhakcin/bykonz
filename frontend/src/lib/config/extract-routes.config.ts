/**
 * Script para extrair rotas do routeTree.gen.ts e atualizar o MAIN_ROUTES
 * em routes.config.ts.
 *
 * Uso: npx tsx src/lib/config/extract-routes.config.ts
 *
 * Fluxo:
 *   1. Lê o routeTree.gen.ts e pega todas as rotas privadas.
 *   2. Descarta rotas com URL ($id), rotas públicas e com
 *      search params obrigatórios (não navegáveis direto pela sidebar).
 *   3. Para cada grupo (segmento base), inclui a rota base sozinha
 *      ou as sub-rotas de primeiro nível.
 *   4. Reescreve o array MAIN_ROUTES no routes.config.ts.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROUTE_TREE_PATH = path.resolve(__dirname, '../../routeTree.gen.ts');
const ROUTE_CONFIG_PATH = path.resolve(__dirname, './routes.config.ts');
const PRIVATE_ROUTES_DIR = path.resolve(__dirname, '../../routes/_private');

const PUBLIC_ROUTES = ['/', '/auth', '/auth/reset-password', '/auth/unlock'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Retorna true se a rota tiver search params obrigatórios via `validateSearch`.
 * Lê o arquivo fonte da rota, encontra o schema usado em `validateSearch:` e
 * verifica se o `z.object({...})` definido inline tem algum campo sem
 * `.optional()`, `.default()` ou `.nullish()`.
 *
 * Schemas importados de outro arquivo são tratados como opcionais.
 */
function hasRequiredSearchParams(routePath: string): boolean {
  const cleaned = routePath.replace(/\/$/, '');
  const candidates = [path.join(PRIVATE_ROUTES_DIR, cleaned, 'index.tsx'), path.join(PRIVATE_ROUTES_DIR, `${cleaned}.tsx`), path.join(PRIVATE_ROUTES_DIR, cleaned, 'route.tsx')];
  const file = candidates.find((p) => fs.existsSync(p));
  if (!file) return false;

  const src = fs.readFileSync(file, 'utf-8');
  const schemaName = src.match(/validateSearch\s*:\s*(\w+)/)?.[1];
  if (!schemaName) return false;

  const schemaBody = src.match(new RegExp(`(?:const|let|var)\\s+${schemaName}\\s*=\\s*z\\.object\\(\\s*\\{([\\s\\S]*?)\\}\\s*\\)`))?.[1];
  if (!schemaBody) return false;

  for (const line of schemaBody.split('\n').map((l) => l.trim())) {
    if (!/:\s*z\./.test(line)) continue;
    if (/\.optional\(\)|\.default\(|\.nullish\(\)/.test(line)) continue;
    return true;
  }
  return false;
}

function isPublicRoute(route: string, routeType: string): boolean {
  if (routeType.startsWith('Public')) return true;
  const normalized = route.replace(/\/$/, '');
  return PUBLIC_ROUTES.includes(route) || PUBLIC_ROUTES.includes(normalized);
}

function segmentsOf(route: string): string[] {
  return route.split('/').filter(Boolean);
}

// ---------------------------------------------------------------------------
// 1. Ler todas as rotas do routeTree.gen.ts
// ---------------------------------------------------------------------------

const routeTreeContent = fs.readFileSync(ROUTE_TREE_PATH, 'utf-8');
const fileRoutesSection = routeTreeContent.match(/export interface FileRoutesByFullPath \{([\s\S]*?)\}/)?.[1];

if (!fileRoutesSection) {
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Filtrar rotas válidas (privadas, sem $param, sem search params obrigatórios)
// ---------------------------------------------------------------------------

const routeEntryRegex = /'([^']+)':\s*typeof\s+(\w+);/g;
const validRoutes: string[] = [];

for (const match of fileRoutesSection.matchAll(routeEntryRegex)) {
  const [, route, routeType] = match;

  if (isPublicRoute(route, routeType)) continue;
  if (/\$\w+/.test(route)) continue;
  if (hasRequiredSearchParams(route)) continue;

  validRoutes.push(route);
}

// ---------------------------------------------------------------------------
// 3. Agrupar por segmento base e selecionar rotas para a sidebar
// ---------------------------------------------------------------------------

const routesByBaseSegment = new Map<string, string[]>();

for (const route of validRoutes) {
  const [baseSegment] = segmentsOf(route);
  if (!baseSegment) continue;

  const group = routesByBaseSegment.get(baseSegment) ?? [];
  group.push(route);
  routesByBaseSegment.set(baseSegment, group);
}

const finalRoutes: string[] = [];

for (const [, group] of routesByBaseSegment) {
  // Grupo com apenas uma rota: incluir a base (ex: /fleet-manager).
  if (group.length === 1) {
    finalRoutes.push(group[0].replace(/\/$/, ''));
    continue;
  }

  // Grupo com várias rotas: incluir apenas o primeiro nível de sub-rotas.
  for (const route of group) {
    if (segmentsOf(route).length === 2) finalRoutes.push(route);
  }
}

finalRoutes.sort();

// ---------------------------------------------------------------------------
// 4. Reescrever o MAIN_ROUTES em routes.config.ts
// ---------------------------------------------------------------------------

if (finalRoutes.length === 0) {
  process.exit(0);
}

const mainRoutesBlock = `export const MAIN_ROUTES = [\n${finalRoutes.map((r) => `  '${r}'`).join(',\n')},\n] as const;`;
const mainRoutesRegex = /export const MAIN_ROUTES = \[[\s\S]*?\] as const;/;

let configContent = fs.readFileSync(ROUTE_CONFIG_PATH, 'utf-8');
configContent = mainRoutesRegex.test(configContent) ? configContent.replace(mainRoutesRegex, mainRoutesBlock) : `${configContent}\n\n${mainRoutesBlock}\n`;

fs.writeFileSync(ROUTE_CONFIG_PATH, configContent);
for (const _r of finalRoutes) {
}
