import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client.api';

// Mutation to update user language in backend
async function updateUserLanguage(language: string): Promise<void> {
  await api.patch('/user/language', { language });
}

export function useUpdateUserLanguage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUserLanguage,
    onSuccess: () => {
      // Invalidate relevant user queries if any
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
}
