import { createFileRoute } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { useLogin } from '@/hooks/use-auth-api';
import { AuthLayout } from '@/routes/_public/auth/@components/AuthLayout';

export const Route = createFileRoute('/_public/auth/')({
  component: LoginPage,
});

function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const isLoading = useAuth((state) => state.isLoading);
  const login = useLogin();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    login.mutate({ email, password });
  }

  return (
    <AuthLayout>
      <form onSubmit={onSubmit} className="w-full">
        <FieldGroup className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-1 text-center">
            <h1 className="font-bold text-2xl">{t('login.title')}</h1>
            <p className="text-balance text-muted-foreground text-sm">{t('login.subtitle')}</p>
          </div>

          <Field>
            <FieldLabel htmlFor="email">{t('login.email.label')}</FieldLabel>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('login.email.placeholder')} />
          </Field>

          <Field>
            <FieldLabel htmlFor="password">{t('login.password.label')}</FieldLabel>
            <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>

          <Button type="submit" disabled={isLoading}>
            {t('login.submit')}
          </Button>
        </FieldGroup>
      </form>

      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Loader2 className="h-12 w-12 animate-spin text-white" />
        </div>
      )}
    </AuthLayout>
  );
}
