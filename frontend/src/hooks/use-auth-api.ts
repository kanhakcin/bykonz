/**
 * TanStack Query hooks for authentication API operations
 */

import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { api } from '@/lib/api/client.api';
import { type AuthUser, useAuth } from './use-auth';

interface LoginResponse {
  token: string;
  user: AuthUser;
}

export function useLogin() {
  const { setAuth, setLoading } = useAuth();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      setLoading(true);
      const response = await api.post<LoginResponse>('/auth/login', {
        email: email.trim(),
        password,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setLoading(false);
      setAuth(data.token, data.user);
      toast.success('Login successful!');
      navigate({ to: '/' });
    },
    onError: () => {
      setLoading(false);
    },
  });
}
