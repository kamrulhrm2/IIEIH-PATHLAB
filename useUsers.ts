import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';
import type { AppUser, UserRole } from '@/types';

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('*').order('username');
      if (error) throw error;
      return data as AppUser[];
    },
  });
}

interface CreateUserInput {
  username: string;
  name: string;
  role: UserRole;
  email: string | null;
  emp_code: string | null;
}

export function useCreateUser() {
  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const { data: hash, error: hashError } = await supabase.rpc('fn_hash_password', {
        plain: input.username,
      });
      if (hashError) throw hashError;
      const { error } = await supabase.from('users').insert({ ...input, password_hash: hash });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (e: Error) => toast.error(`Failed to create user — ${e.message}`),
  });
}

export function useUpdateUser() {
  return useMutation({
    mutationFn: async (input: {
      id: string;
      role?: UserRole;
      email?: string | null;
      is_active?: boolean;
      resetPasswordTo?: string;
    }) => {
      const { id, resetPasswordTo, ...fields } = input;
      const payload: Record<string, unknown> = { ...fields };
      if (resetPasswordTo) {
        const { data: hash, error: hashError } = await supabase.rpc('fn_hash_password', {
          plain: resetPasswordTo,
        });
        if (hashError) throw hashError;
        payload.password_hash = hash;
      }
      const { error } = await supabase.from('users').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (e: Error) => toast.error(`Failed to update user — ${e.message}`),
  });
}

export function useDeleteUser() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (e: Error) => toast.error(`Failed to delete user — ${e.message}`),
  });
}
