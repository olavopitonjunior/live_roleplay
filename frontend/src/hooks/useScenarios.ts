import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Scenario, GeneratedScenario, GenerateScenarioRequest, SuggestedScenarioFields } from '../types';

/** Build request body, only including access_code when provided */
function buildBody(accessCode: string | null, extra: Record<string, unknown>): Record<string, unknown> {
  const body: Record<string, unknown> = { ...extra };
  if (accessCode) body.access_code = accessCode;
  return body;
}

export function useScenarios() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const fetchScenarios = useCallback(async (includeInactive = false) => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase.from('scenarios').select('*');

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error: fetchError } = await query.order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setScenarios((data as Scenario[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar cenarios');
    } finally {
      setLoading(false);
    }
  }, []);

  const createScenario = useCallback(async (
    accessCode: string | null,
    scenario: Omit<Scenario, 'id' | 'created_at' | 'updated_at'>
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-scenario', {
        body: buildBody(accessCode, { action: 'create', data: scenario }),
      });

      if (error) {
        let msg = 'Erro ao criar cenario';
        try {
          if (error.context && typeof error.context.json === 'function') {
            const body = await error.context.json();
            msg = body?.error || body?.message || error.message || msg;
          } else {
            msg = error.message || msg;
          }
        } catch { msg = error.message || msg; }
        return { data: null, error: { message: msg } };
      }

      if (data?.scenario) {
        setScenarios(prev => [data.scenario as Scenario, ...prev]);
        return { data: data.scenario as Scenario, error: null };
      }

      return { data: null, error: { message: 'Resposta invalida do servidor' } };
    } catch (err) {
      return { data: null, error: { message: err instanceof Error ? err.message : 'Erro ao criar cenario' } };
    }
  }, []);

  const updateScenario = useCallback(async (
    accessCode: string | null,
    id: string,
    updates: Partial<Scenario>
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-scenario', {
        body: buildBody(accessCode, { action: 'update', scenario_id: id, data: updates }),
      });

      if (error) {
        let msg = 'Erro ao atualizar cenario';
        try {
          if (error.context && typeof error.context.json === 'function') {
            const body = await error.context.json();
            msg = body?.error || body?.message || error.message || msg;
          } else {
            msg = error.message || msg;
          }
        } catch { msg = error.message || msg; }
        return { data: null, error: { message: msg } };
      }

      if (data?.scenario) {
        setScenarios(prev => prev.map(s => s.id === id ? (data.scenario as Scenario) : s));
        return { data: data.scenario as Scenario, error: null };
      }

      return { data: null, error: { message: 'Resposta invalida do servidor' } };
    } catch (err) {
      return { data: null, error: { message: err instanceof Error ? err.message : 'Erro ao atualizar cenario' } };
    }
  }, []);

  const deleteScenario = useCallback(async (accessCode: string | null, id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-scenario', {
        body: buildBody(accessCode, { action: 'delete', scenario_id: id }),
      });

      if (error) {
        let msg = 'Erro ao excluir cenario';
        try {
          if (error.context && typeof error.context.json === 'function') {
            const body = await error.context.json();
            msg = body?.error || body?.message || error.message || msg;
          } else {
            msg = error.message || msg;
          }
        } catch { msg = error.message || msg; }
        return { data: null, error: { message: msg } };
      }

      if (data?.scenario) {
        setScenarios(prev => prev.filter(s => s.id !== id));
        return { data: data.scenario as Scenario, error: null };
      }

      return { data: null, error: { message: 'Resposta invalida do servidor' } };
    } catch (err) {
      return { data: null, error: { message: err instanceof Error ? err.message : 'Erro ao excluir cenario' } };
    }
  }, []);

  const generateScenario = useCallback(async (
    accessCode: string | null,
    request: GenerateScenarioRequest
  ): Promise<{ data: GeneratedScenario | null; error: { message: string } | null }> => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-scenario', {
        body: buildBody(accessCode, {
          description: request.description,
          industry: request.industry,
          difficulty: request.difficulty,
        }),
      });

      if (error) {
        let msg = 'Erro ao gerar cenario';
        try {
          if (error.context && typeof error.context.json === 'function') {
            const body = await error.context.json();
            msg = body?.error || body?.message || error.message || msg;
          } else {
            msg = error.message || msg;
          }
        } catch { msg = error.message || msg; }
        return { data: null, error: { message: msg } };
      }

      if (data?.scenario) {
        return { data: data.scenario as GeneratedScenario, error: null };
      }

      return { data: null, error: { message: 'Resposta invalida do servidor' } };
    } catch (err) {
      return { data: null, error: { message: err instanceof Error ? err.message : 'Erro ao gerar cenario' } };
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const suggestScenarioFields = useCallback(async (
    accessCode: string | null,
    title: string,
    context: string
  ): Promise<{ data: SuggestedScenarioFields | null; error: { message: string } | null }> => {
    setIsSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-scenario-fields', {
        body: buildBody(accessCode, { title, context }),
      });

      if (error) {
        let msg = 'Erro ao gerar sugestoes';
        try {
          if (error.context && typeof error.context.json === 'function') {
            const body = await error.context.json();
            msg = body?.error || body?.message || error.message || msg;
          } else {
            msg = error.message || msg;
          }
        } catch { msg = error.message || msg; }
        return { data: null, error: { message: msg } };
      }

      if (data?.fields) {
        return { data: data.fields as SuggestedScenarioFields, error: null };
      }

      return { data: null, error: { message: 'Resposta invalida do servidor' } };
    } catch (err) {
      return { data: null, error: { message: err instanceof Error ? err.message : 'Erro ao gerar sugestoes' } };
    } finally {
      setIsSuggesting(false);
    }
  }, []);

  useEffect(() => {
    fetchScenarios();
  }, [fetchScenarios]);

  return {
    scenarios,
    loading,
    error,
    isGenerating,
    isSuggesting,
    fetchScenarios,
    createScenario,
    updateScenario,
    deleteScenario,
    generateScenario,
    suggestScenarioFields,
  };
}
