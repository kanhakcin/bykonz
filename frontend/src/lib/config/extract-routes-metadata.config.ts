import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Uso: pnpm run routes:ai
 */

interface RouteSearchParam {
  name: string;
  type: 'string' | 'date' | 'number' | 'boolean' | 'array';
  description: string;
  required?: boolean;
  example?: string;
}

interface RouteRelation {
  path: string;
  relation: 'parent' | 'child' | 'sibling' | 'alternative';
  description?: string;
}

interface RouteInfo {
  path: string;
  title?: string;
  description?: string;
  tags?: string[];
  examplePrompts?: string[];
  searchParams?: RouteSearchParam[];
  relatedRoutes?: RouteRelation[];
  entities?: string[];
  capabilities?: string[];
}

const ROUTES_DIR = path.join(process.cwd(), 'src/routes/_private');
const OUTPUT_DIR = path.join(process.cwd(), 'public/ai');

const INDEX_FILE = path.join(OUTPUT_DIR, 'routes.index.json');
const SEMANTIC_FILE = path.join(OUTPUT_DIR, 'routes.semantic.jsonl');
const GRAPH_FILE = path.join(OUTPUT_DIR, 'routes.graph.json');

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function extractStaticData(filePath: string): RouteInfo | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    const pathMatch = content.match(/createFileRoute\(['"]([^'"]+)['"]\)/);
    if (!pathMatch) return null;

    const routePath = pathMatch[1];
    if (!content.includes('staticData:')) return null;

    const titleMatch = content.match(/title:\s*['"]([^'"]+)['"]/);
    const descMatch = content.match(/description:\s*['"]([^'"]+)['"]/);

    const tagsMatch = content.match(/tags:\s*\[([^\]]+)\]/);
    const tags = tagsMatch
      ? tagsMatch[1]
          .split(',')
          .map((t) => t.trim().replace(/['"]/g, ''))
          .filter(Boolean)
      : undefined;

    const promptsMatch = content.match(/examplePrompts:\s*\[([\s\S]*?)\]/);
    const examplePrompts = promptsMatch
      ? promptsMatch[1]
          .split(',')
          .map((p) => p.trim().replace(/['"]/g, ''))
          .filter(Boolean)
      : undefined;

    const entitiesMatch = content.match(/entities:\s*\[([^\]]+)\]/);
    const entities = entitiesMatch
      ? entitiesMatch[1]
          .split(',')
          .map((e) => e.trim().replace(/['"]/g, ''))
          .filter(Boolean)
      : undefined;

    const capsMatch = content.match(/capabilities:\s*\[([^\]]+)\]/);
    const capabilities = capsMatch
      ? capsMatch[1]
          .split(',')
          .map((c) => c.trim().replace(/['"]/g, ''))
          .filter(Boolean)
      : undefined;

    const searchParams = extractSearchParams(content);
    const relatedRoutes = extractRelatedRoutes(content);

    return {
      path: routePath,
      title: titleMatch?.[1],
      description: descMatch?.[1],
      tags,
      examplePrompts,
      searchParams,
      relatedRoutes,
      entities,
      capabilities,
    };
  } catch {
    return null;
  }
}

function extractSearchParams(content: string): RouteSearchParam[] | undefined {
  const match = content.match(/searchParams:\s*\[([\s\S]*?)\]/);
  if (!match) return undefined;

  const blocks = match[1].match(/\{[^}]+\}/g);
  if (!blocks) return undefined;

  return blocks
    .map((block) => ({
      name: block.match(/name:\s*['"]([^'"]+)['"]/)?.[1] ?? '',
      type: block.match(/type:\s*['"]([^'"]+)['"]/)?.[1] as RouteSearchParam['type'],
      description: block.match(/description:\s*['"]([^'"]+)['"]/)?.[1] ?? '',
      example: block.match(/example:\s*['"]([^'"]+)['"]/)?.[1],
      required: block.includes('required: true') || undefined,
    }))
    .filter((p) => p.name && p.type && p.description);
}

function extractRelatedRoutes(content: string): RouteRelation[] | undefined {
  const match = content.match(/relatedRoutes:\s*\[([\s\S]*?)\]/);
  if (!match) return undefined;

  const blocks = match[1].match(/\{[^}]+\}/g);
  if (!blocks) return undefined;

  return blocks
    .map((block) => ({
      path: block.match(/path:\s*['"]([^'"]+)['"]/)?.[1] ?? '',
      relation: block.match(/relation:\s*['"]([^'"]+)['"]/)?.[1] as RouteRelation['relation'],
      description: block.match(/description:\s*['"]([^'"]+)['"]/)?.[1],
    }))
    .filter((r) => r.path && r.relation);
}

function walkDir(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkDir(fullPath);
    if (entry.isFile() && entry.name === 'index.tsx') return [fullPath];
    return [];
  });
}

function buildSemanticText(route: RouteInfo) {
  // principal busca pela ia vem de "examplePrompts"
  if (route.examplePrompts && route.examplePrompts.length > 0) {
    return route.examplePrompts.join('. ');
  }
  return [route.description, route.capabilities?.join(', ')].filter(Boolean).join('. ');
}

function main() {
  const files = walkDir(ROUTES_DIR);
  const routes: RouteInfo[] = [];

  for (const file of files) {
    const info = extractStaticData(file);
    if (info) routes.push(info);
  }

  routes.sort((a, b) => a.path.localeCompare(b.path));

  // -----------------------------
  // 1) INDEX FILE
  // -----------------------------
  const index = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    totalRoutes: routes.length,
    routes: routes.map((r) => ({
      id: r.path.replace(/\W+/g, '_'),
      path: r.path,
      title: r.title ?? r.path,
      embeddingKey: r.path.replace(/\W+/g, '_'),
    })),
  };

  // -----------------------------
  // 2) SEMANTIC JSONL FILE
  // -----------------------------
  const semanticLines = routes
    .map((r) => {
      return JSON.stringify({
        id: r.path.replace(/\W+/g, '_'),
        path: r.path,
        title: r.title,
        semantic_text: buildSemanticText(r),
        // intents removido pois virou semantic_text
        capabilities: r.capabilities,
        tags: r.tags,
        entities: r.entities,
        priority: 1.0,
        query_schema: r.searchParams?.reduce(
          (acc, p) => {
            acc[p.name] = `${p.type} - ${p.description}`;
            return acc;
          },
          {} as Record<string, string>,
        ),
      });
    })
    .join('\n');

  // -----------------------------
  // 3) GRAPH FILE
  // -----------------------------
  const graph = {
    nodes: routes.map((r) => ({
      id: r.path.replace(/\W+/g, '_'),
      type: 'page',
      label: r.title ?? r.path,
    })),
    edges: routes.flatMap(
      (r) =>
        r.relatedRoutes?.map((rel) => ({
          from: r.path.replace(/\W+/g, '_'),
          to: rel.path.replace(/\W+/g, '_'),
          relation: rel.relation,
          description: rel.description,
        })) ?? [],
    ),
  };

  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
  fs.writeFileSync(SEMANTIC_FILE, semanticLines);
  fs.writeFileSync(GRAPH_FILE, JSON.stringify(graph, null, 2));

  process.stdout.write(`✅ Generated IA optimized files (${routes.length} routes)\n`);
}

main();
