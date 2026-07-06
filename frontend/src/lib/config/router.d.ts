import '@tanstack/react-router';

/**
 * Metadados de parâmetros de busca (search params)
 */
export interface RouteSearchParam {
  /** Nome do parâmetro na URL */
  name: string;
  /** Tipo do parâmetro */
  type: 'string' | 'date' | 'number' | 'boolean' | 'array';
  /** Descrição do que o parâmetro faz */
  description: string;
  /** Se o parâmetro é obrigatório */
  required?: boolean;
  /** Exemplo de valor */
  example?: string;
}

/**
 * Metadados de rotas relacionadas
 */
export interface RouteRelation {
  /** Path da rota relacionada */
  path: string;
  /** Tipo de relação */
  relation: 'parent' | 'child' | 'sibling' | 'alternative' | 'redirect';
  /** Descrição da relação */
  description?: string;
}

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /** Título da rota (chave i18n) para Breadcrumbs e CardHeader */
    title?: string;
    /** Função para obter o título dinamicamente (para rotas com $params) */
    getTitle?: () => string;
    /** Descrição da página (exibida em tooltip) */
    description?: string;
    /** Tags para categorização e busca semântica */
    tags?: string[];
    /** Exemplos de prompts/perguntas que levariam a essa página */
    examplePrompts?: string[];
    /** Parâmetros de busca (search params) que a página aceita */
    searchParams?: RouteSearchParam[];
    /** Rotas relacionadas */
    relatedRoutes?: RouteRelation[];
    /** Entidades/dados que a página exibe */
    entities?: string[];
    /** Ações/funcionalidades disponíveis na página */
    capabilities?: string[];
  }
}
