import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import DefaultEmptyData from '@/components/default-empty-data';
import DefaultLoading from '@/components/default-loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { useTelegramApi, useTelegramChats, useTelegramDashboard, useTelegramLogs, useTelegramMessages, useTelegramSettings } from '@/hooks/use-telegram-api';
import { formatDate } from '@/lib/helpers/format-date.helper';

export const Route = createFileRoute('/_private/telegram/')({
  staticData: {
    title: 'telegram.title',
    description: 'Gerenciamento do bot do Telegram: dashboard, configurações, mensagens, canais, envio e logs.',
    tags: ['telegram', 'bot', 'mensagens', 'canal'],
    capabilities: [
      'Ver status, nome e username do bot',
      'Configurar token e ativar/desativar integração',
      'Listar conversas e mensagens',
      'Enviar mensagem para usuário/grupo/canal',
      'Visualizar logs de envio, recebimento e erros',
    ],
  },
  component: TelegramPage,
});

function TelegramPage() {
  const { t } = useTranslation();
  const role = useAuth((s) => s.user?.role);
  const isAdmin = role === 'ADMIN';

  const { data: dashboard, isLoading: loadingDash } = useTelegramDashboard();

  return (
    <Card>
      <CardHeader title={t('telegram.title')} />
      <CardContent>
        {loadingDash ? (
          <DefaultLoading />
        ) : (
          <Tabs defaultValue="dashboard">
            <TabsList className="flex w-full flex-wrap justify-start">
              <TabsTrigger value="dashboard">{t('telegram.tab.dashboard')}</TabsTrigger>
              <TabsTrigger value="settings">{t('telegram.tab.settings')}</TabsTrigger>
              <TabsTrigger value="messages">{t('telegram.tab.messages')}</TabsTrigger>
              <TabsTrigger value="chats">{t('telegram.tab.chats')}</TabsTrigger>
              {isAdmin && <TabsTrigger value="send">{t('telegram.tab.send')}</TabsTrigger>}
              <TabsTrigger value="logs">{t('telegram.tab.logs')}</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard">
              <DashboardTab dashboard={dashboard} />
            </TabsContent>
            <TabsContent value="settings">
              <SettingsTab />
            </TabsContent>
            <TabsContent value="messages">
              <MessagesTab />
            </TabsContent>
            <TabsContent value="chats">
              <ChatsTab />
            </TabsContent>
            {isAdmin && (
              <TabsContent value="send">
                <SendTab />
              </TabsContent>
            )}
            <TabsContent value="logs">
              <LogsTab />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Dashboard -------------------------------------------------------------

function DashboardTab({ dashboard }: { dashboard?: ReturnType<typeof useTelegramDashboard>['data'] }) {
  const { t } = useTranslation();
  if (!dashboard) return null;
  const statusVariant = dashboard.status === 'online' ? 'success' : dashboard.status === 'disabled' ? 'secondary' : 'error';

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent>
          <p className="text-muted-foreground text-sm">{t('telegram.status')}</p>
          <Badge variant={statusVariant}>{t(`telegram.status.${dashboard.status}`)}</Badge>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <p className="text-muted-foreground text-sm">{t('telegram.botName')}</p>
          <p className="font-medium">{dashboard.botName ?? '—'}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <p className="text-muted-foreground text-sm">{t('telegram.username')}</p>
          <p className="font-medium">{dashboard.username ? `@${dashboard.username}` : '—'}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <p className="text-muted-foreground text-sm">{t('telegram.lastConnection')}</p>
          <p className="font-medium">{dashboard.lastConnection ? formatDate(dashboard.lastConnection, 'dd/MM/yyyy HH:mm') : '—'}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <p className="text-muted-foreground text-sm">{t('telegram.token')}</p>
          <p className="font-medium">{dashboard.tokenMasked ?? '—'}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <p className="text-muted-foreground text-sm">{t('telegram.messagesSent')}</p>
          <p className="font-semibold text-2xl">{dashboard.counts.sent}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <p className="text-muted-foreground text-sm">{t('telegram.messagesReceived')}</p>
          <p className="font-semibold text-2xl">{dashboard.counts.received}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <p className="text-muted-foreground text-sm">{t('telegram.conversations')}</p>
          <p className="font-semibold text-2xl">{dashboard.counts.conversations}</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Configurações ---------------------------------------------------------

function SettingsTab() {
  const { t } = useTranslation();
  const { data: settings, isLoading } = useTelegramSettings();
  const { updateSettings, testConnection } = useTelegramApi();
  const [token, setToken] = useState('');
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined);

  if (isLoading) return <DefaultLoading />;
  const currentEnabled = enabled ?? settings?.enabled ?? false;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t('telegram.settings.token')} />
        <CardContent className="space-y-3">
          {settings?.tokenConfigured && (
            <p className="text-muted-foreground text-sm">
              {t('telegram.settings.current')}: <span className="font-mono">{settings.tokenMasked}</span>
            </p>
          )}
          <Input type="password" placeholder={t('telegram.settings.tokenPlaceholder')} value={token} onChange={(e) => setToken(e.target.value)} />
          <div className="flex items-center gap-2">
            <Switch
              checked={currentEnabled}
              onCheckedChange={(v) => {
                setEnabled(v);
                void updateSettings.mutateAsync({ enabled: v });
              }}
            />
            <span className="text-sm">{t('telegram.settings.enabled')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={updateSettings.isPending || (!token && enabled === undefined)} onClick={() => void updateSettings.mutateAsync({ token: token || undefined })}>
              {t('save')}
            </Button>
            <Button
              variant="outline"
              disabled={testConnection.isPending}
              onClick={() => {
                const result = testConnection.mutateAsync();
                void result.then((r) => {
                  if (r.ok) toast.success(t('telegram.settings.testOk'));
                  else toast.error(r.error ?? t('telegram.settings.testFail'));
                });
              }}
            >
              {t('telegram.settings.test')}
            </Button>
          </div>
          {settings?.lastError && (
            <p className="text-destructive text-sm">
              {t('telegram.settings.lastError')}: {settings.lastError}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Mensagens -------------------------------------------------------------

function MessagesTab() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const { data, isLoading } = useTelegramMessages({ search: search || undefined, page, size: 20 });

  const items = data?.data ?? [];
  const totalCount = data?.totalCount ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder={t('search')}
          className="max-w-64"
          defaultValue={search}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setSearch(e.currentTarget.value);
              setPage(0);
            }
          }}
        />
        <Button variant="outline" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
          {t('previous')}
        </Button>
        <span className="text-muted-foreground text-sm">
          {t('total')}: {totalCount}
        </span>
        <Button variant="outline" disabled={(page + 1) * 20 >= totalCount} onClick={() => setPage((p) => p + 1)}>
          {t('next')}
        </Button>
      </div>
      {isLoading ? (
        <DefaultLoading />
      ) : items.length === 0 ? (
        <DefaultEmptyData />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('telegram.column.date')}</TableHead>
                <TableHead>{t('telegram.column.direction')}</TableHead>
                <TableHead>{t('telegram.column.chat')}</TableHead>
                <TableHead>{t('telegram.column.text')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap tabular-nums">{formatDate(m.createdAt, 'dd/MM/yyyy HH:mm')}</TableCell>
                  <TableCell>
                    <Badge variant={m.direction === 'INBOUND' ? 'secondary' : 'success'}>{t(`telegram.direction.${m.direction.toLowerCase()}`)}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{m.chatId}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{m.text ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ---- Canais / chats --------------------------------------------------------

function ChatsTab() {
  const { t } = useTranslation();
  const { data: chats, isLoading } = useTelegramChats();
  const { refetch } = useTelegramApi();

  if (isLoading) return <DefaultLoading />;
  const items = chats ?? [];

  return (
    <div className="space-y-3">
      <Button variant="outline" onClick={() => refetch()}>
        {t('telegram.refresh')}
      </Button>
      {items.length === 0 ? (
        <DefaultEmptyData />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('telegram.column.name')}</TableHead>
                <TableHead>{t('chatId')}</TableHead>
                <TableHead>{t('telegram.column.type')}</TableHead>
                <TableHead>{t('status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell className="font-mono text-sm">{c.chatId}</TableCell>
                  <TableCell>{c.type}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === 'active' ? 'success' : 'secondary'}>{c.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ---- Envio ----------------------------------------------------------------

function SendTab() {
  const { t } = useTranslation();
  const { sendMessage } = useTelegramApi();
  const { data: chats } = useTelegramChats();
  const [chatId, setChatId] = useState('');
  const [text, setText] = useState('');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t('telegram.send.title')} />
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm">{t('telegram.send.chatId')}</label>
            <Select value={chatId} onValueChange={setChatId}>
              <SelectTrigger>
                <SelectValue placeholder={t('select.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                {(chats ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.chatId}>
                    {c.name} ({c.chatId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea placeholder={t('telegram.send.text')} value={text} onChange={(e) => setText(e.target.value)} />
          <Button
            disabled={sendMessage.isPending || !chatId || !text.trim()}
            onClick={() => {
              void sendMessage.mutateAsync({ chatId, text }).then(() => {
                toast.success(t('telegram.send.ok'));
                setText('');
              });
            }}
          >
            {t('send')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Logs ------------------------------------------------------------------

function LogsTab() {
  const { t } = useTranslation();
  const [type, setType] = useState<string>('');
  const [page, setPage] = useState(0);
  const { data, isLoading } = useTelegramLogs({ type: type || undefined, page, size: 20 });

  const items = data?.data ?? [];
  const totalCount = data?.totalCount ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={type}
          onValueChange={(v) => {
            setType(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t('telegram.logs.type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('telegram.logs.all')}</SelectItem>
            <SelectItem value="SENT">{t('telegram.logs.sent')}</SelectItem>
            <SelectItem value="RECEIVED">{t('telegram.logs.received')}</SelectItem>
            <SelectItem value="ERROR">{t('telegram.logs.error')}</SelectItem>
            <SelectItem value="SYSTEM">{t('telegram.logs.system')}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>
          {t('previous')}
        </Button>
        <span className="text-muted-foreground text-sm">
          {t('total')}: {totalCount}
        </span>
        <Button variant="outline" disabled={(page + 1) * 20 >= totalCount} onClick={() => setPage((p) => p + 1)}>
          {t('next')}
        </Button>
      </div>
      {isLoading ? (
        <DefaultLoading />
      ) : items.length === 0 ? (
        <DefaultEmptyData />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('telegram.column.date')}</TableHead>
                <TableHead>{t('telegram.column.type')}</TableHead>
                <TableHead>{t('telegram.column.chat')}</TableHead>
                <TableHead>{t('telegram.column.message')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap tabular-nums">{formatDate(l.createdAt, 'dd/MM/yyyy HH:mm')}</TableCell>
                  <TableCell>
                    <Badge variant={l.type === 'ERROR' ? 'error' : 'secondary'}>{l.type}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{l.chatId ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{l.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
