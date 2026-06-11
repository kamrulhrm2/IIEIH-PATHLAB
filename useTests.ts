import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';
import type { LabTest } from '@/types';

export function useTests(includeInactive = false) {
  return useQuery({
    queryKey: ['tests', includeInactive],
    queryFn: async () => {
      let q = supabase.from('tests').select('*').order('code');
      if (!includeInactive) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return data as LabTest[];
    },
    staleTime: 60_000,
  });
}

export function useSaveTest() {
  return useMutation({
    mutationFn: async (test: Partial<LabTest>) => {
      const { id, created_at, updated_at, ...fields } = test;
      if (id) {
        const { error } = await supabase.from('tests').update(fields).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tests').insert(fields);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tests'] }),
    onError: (e: Error) => toast.error(`Failed to save test — ${e.message}`),
  });
}

/** Soft delete — sets is_active = false */
export function useDeleteTest() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tests').update({ is_active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tests'] }),
    onError: (e: Error) => toast.error(`Failed to delete test — ${e.message}`),
  });
}
