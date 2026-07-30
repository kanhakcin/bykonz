import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import DefaultEmptyData from '@/components/default-empty-data';
import DefaultLoading from '@/components/default-loading';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/use-auth';
import { type AuditLog, useAuditLogs } from '@/hooks/use-audit-logs-api';
import { formatDate } from '@/lib/helpers/format-date.helper';

const searchSchema = z.object({
  page: z.number().optional(),
  size: z.number().optional(),
  search: z.string().optional(),
  action: z.string().optional(),
});

type SearchParams = z.infer<typeof searchSchema>;

// Ações auditadas. value = action no backend; label via i18n.
const ACTION_OPTIONS = [
  'entry.description.updated',
  'report.generated',
  'report.email.sent',
  'report.email.failed',
  'report.whatsapp.sent',
  'report.whatsapp.failed',
  'report.downloaded.panel',
  'report.generated.bot',
] as const;

const ALL_ACTIONS = '__all__';

export const Route = createFileRoute('/_private/logs/')({
  staticData: {
    title: 'logs.title',
    description: 'Trilha de auditoria de geração e envio de relatórios (e-mail, WhatsApp, painel, bot).',
    tags: ['logs', 'auditoria', 'audit'],
    entities: ['AuditLog'],
    capabilities: ['Listar logs de auditoria', 'Filtrar por ação', 'Buscar por destinatário/obra'],
  },
  component: AuditLogsPage,
  validateSearch: (search: Record<string, unknown>): SearchParams => searchSchema.parse(search),
});

function AuditLogsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate({ from: Route.fullPath });
  const role = useAuth((s) => s.user?.role);
  const { page = 1, size = 20, search, action } = useSearch({ from: '/_private/logs/' });

  const isAdmin = role === 'ADMIN';
  const { data, isLoading } = useAuditLogs({ search, action, page: page - 1, size });

  const items = data?.data ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / size);

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader title={t('logs.title')} />
        <CardContent>
          <p className="text-muted-foreground text-sm">{t('user.notAllowed')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title={t('logs.title')}>
        <div className="flex w-full flex-col items-center gap-4 sm:w-auto sm:flex-row">
          <Select
            value={action ?? ALL_ACTIONS}
            onValueChange={(val) =>
              navigate({ search: (prev: SearchParams) => ({ ...prev, action: val === ALL_ACTIONS ? undefined : val, page: 1 }) })
            }
          >
            <SelectTrigger className="h-9 w-full sm:w-64">
              <SelectValue placeholder={t('logs.action')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ACTIONS}>{t('logs.action.all')}</SelectItem>
              {ACTION_OPTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {t(`logs.action.${a}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative w-full sm:max-w-64">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('search')}
              className="pl-8"
              defaultValue={search || ''}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  navigate({ search: (prev: SearchParams) => ({ ...prev, search: e.currentTarget.value || undefined, page: 1 }) });
                }
              }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <DefaultLoading />
        ) : items.length === 0 ? (
          <DefaultEmptyData />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('logs.column.datetime')}</TableHead>
                  <TableHead>{t('logs.column.action')}</TableHead>
                  <TableHead>{t('logs.column.actor')}</TableHead>
                  <TableHead>{t('logs.column.details')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatDate(log.createdAt, 'dd/MM/yyyy HH:mm', '-')}
                    </TableCell>
                    <TableCell>{t(`logs.action.${log.action}`, log.action)}</TableCell>
                    <TableCell>{log.actorLabel ?? t(`logs.actor.${log.actorType}`, log.actorType)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{describeMetadata(log)}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === 'ERROR' ? 'error' : 'success'}>
                        {log.status === 'ERROR' ? t('error') : 'OK'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {totalCount > 0 && (
        <CardFooter layout="multi">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <span>{t('show')}</span>
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
            <span>{t('per.page')}</span>
            <span className="ml-4 tabular-nums">
              {t('total')}: {totalCount}
            </span>
          </div>

          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => page > 1 && navigate({ search: (prev: SearchParams) => ({ ...prev, page: page - 1 }) })}
                  className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  onClick={() => page < totalPages && navigate({ search: (prev: SearchParams) => ({ ...prev, page: page + 1 }) })}
                  className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </CardFooter>
      )}
    </Card>
  );
}

/** Resumo legível do metadata do log (obra, destinatários, arquivo, erro, correção de texto). */
function describeMetadata(log: AuditLog): string {
  const m = log.metadata ?? {};
  const parts: string[] = [];
  if (typeof m.obraNome === 'string') parts.push(m.obraNome);
  if (typeof m.date === 'string') parts.push(m.date);
  if (Array.isArray(m.recipients) && m.recipients.length > 0) parts.push(m.recipients.join(', '));
  if (typeof m.filename === 'string') parts.push(m.filename);
  // Correção de descrição: o valor do log é o antes/depois do texto.
  if (typeof m.before === 'string' || typeof m.after === 'string') {
    parts.push(`"${truncate(String(m.before ?? ''))}" → "${truncate(String(m.after ?? ''))}"`);
  }
  if (typeof m.error === 'string') parts.push(m.error);
  return parts.join(' · ');
}

function truncate(value: string, max = 60): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
