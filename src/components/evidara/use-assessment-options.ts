'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { AssessmentOption, AssessmentOptionGroup } from '@/types/assessment-options';
import { FALLBACK_ASSESSMENT_OPTIONS } from '@/types/assessment-options';

function mergeOptions(rows: AssessmentOption[], organizationId: string | null, includeInactive: boolean) {
  const groups = new Map<AssessmentOptionGroup, Map<string, AssessmentOption>>();
  (['grade', 'exam_type', 'test_type'] as AssessmentOptionGroup[]).forEach((group) => groups.set(group, new Map()));
  rows
    .filter((row) => includeInactive || row.is_active)
    .sort((a, b) => Number(Boolean(a.organization_id)) - Number(Boolean(b.organization_id)) || a.display_order - b.display_order || a.label.localeCompare(b.label))
    .forEach((row) => {
      if (row.organization_id && row.organization_id !== organizationId) return;
      groups.get(row.option_group)?.set(row.value.toLowerCase(), row);
    });
  return Object.fromEntries([...groups.entries()].map(([group, values]) => [group, [...values.values()].sort((a, b) => a.display_order - b.display_order || a.label.localeCompare(b.label))])) as Record<AssessmentOptionGroup, AssessmentOption[]>;
}

export function useAssessmentOptions(organizationId: string | null, includeInactive = false) {
  const [rows, setRows] = useState<AssessmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!supabase) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    let query = supabase
      .from('assessment_options')
      .select('id,organization_id,option_group,value,label,code,display_order,is_active,metadata')
      .order('display_order')
      .order('label');
    if (!includeInactive) query = query.eq('is_active', true);
    query = organizationId
      ? query.or(`organization_id.is.null,organization_id.eq.${organizationId}`)
      : query.is('organization_id', null);
    const { data, error: loadError } = await query;
    if (loadError) {
      setError(/assessment_options|does not exist|not found/i.test(loadError.message) ? 'Apply Supabase migration 33 to enable configurable grades and examinations.' : loadError.message);
      setRows([]);
    } else {
      setRows((data || []) as AssessmentOption[]);
    }
    setLoading(false);
  }, [includeInactive, organizationId]);

  useEffect(() => { void load(); }, [load]);

  const grouped = useMemo(() => {
    const database = mergeOptions(rows, organizationId, includeInactive);
    return Object.fromEntries((['grade', 'exam_type', 'test_type'] as AssessmentOptionGroup[]).map((group) => [
      group,
      database[group].length ? database[group] : FALLBACK_ASSESSMENT_OPTIONS[group],
    ])) as Record<AssessmentOptionGroup, AssessmentOption[]>;
  }, [includeInactive, organizationId, rows]);

  return {
    rows,
    grades: grouped.grade,
    exams: grouped.exam_type,
    testTypes: grouped.test_type,
    loading,
    error,
    reload: load,
  };
}
