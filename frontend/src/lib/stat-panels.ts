import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createStatPanel,
  deleteStatPanel,
  listStatPanels,
  previewStatPanel,
  updateStatPanel,
} from '@/lib/api';
import { formatDurationHours } from '@/lib/project-workspace';
import { toast } from '@/lib/toast';
import type { FieldDefinition, StatPanelAggregation, StatPanelInput } from '@/types';

export const PREVIEW_DEBOUNCE_MS = 300;

export const RANGE_OPTIONS = [7, 30, 90];

export const AGGREGATION_OPTIONS: { value: StatPanelAggregation; label: string }[] = [
  { value: 'sum', label: 'Sum' },
  { value: 'average', label: 'Average' },
];

export function useDebouncedValue<T>(value: T, delay = PREVIEW_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function isValidProjectId(projectId: string) {
  return Number.isInteger(Number(projectId)) && Number(projectId) > 0;
}

// One request returns every panel with its value and sparkline series.
export function useStatPanels(projectId: string) {
  return useQuery({
    queryKey: ['stat-panels', projectId],
    queryFn: () => listStatPanels(projectId),
    enabled: isValidProjectId(projectId),
  });
}

// Pass null to stay idle (empty formula).
export function useStatPanelPreview(projectId: string, input: StatPanelInput | null) {
  return useQuery({
    queryKey: ['stat-panel-preview', projectId, input],
    queryFn: () => previewStatPanel(projectId, input as StatPanelInput),
    enabled: input !== null && isValidProjectId(projectId),
    retry: false,
    staleTime: 30_000,
  });
}

type PanelBody = StatPanelInput & { name: string };

export function useStatPanelMutations(projectId: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['stat-panels', projectId] });

  const create = useMutation({
    mutationFn: (body: PanelBody) => createStatPanel(projectId, body),
    onSuccess: refresh,
    onError: (error) => toast.error(error),
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: Partial<PanelBody & { hidden: boolean }> & { id: number }) =>
      updateStatPanel(projectId, id, body),
    onSuccess: refresh,
    onError: (error) => toast.error(error),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteStatPanel(projectId, id),
    onSuccess: refresh,
    onError: (error) => toast.error(error),
  });

  return { create, update, remove };
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}

type Dimension = 'time' | 'scalar';
type Token = Dimension | '+' | '-' | '*' | '/' | '(' | ')';

// Reads a formula like arithmetic and works out what kind of answer it gives.
// Duration fields are lengths of time, every other field and every plain
// number is a bare count. Then the usual rules apply:
//   time + time = time, time * 2 = time, time / 2 = time,
//   time / time = a plain number, pages / time = a rate (not time),
//   time + pages = nonsense (not time).
// Returns null when the formula can't be read or isn't a plain number or time.
function formulaDimension(expression: string, fields: FieldDefinition[]): Dimension | null {
  const names = fields
    .map((f) => ({
      name: f.name,
      dim: (f.fieldType === 'duration' ? 'time' : 'scalar') as Dimension,
    }))
    .sort((a, b) => b.name.length - a.name.length);

  const tokens: Token[] = [];
  let i = 0;
  while (i < expression.length) {
    const ch = expression[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    const field = names.find(
      (f) => expression.startsWith(f.name, i) && !/\w/.test(expression[i + f.name.length] ?? ''),
    );
    if (field) {
      tokens.push(field.dim);
      i += field.name.length;
      continue;
    }
    const number = /^\d+(\.\d+)?/.exec(expression.slice(i));
    if (number) {
      tokens.push('scalar');
      i += number[0].length;
      continue;
    }
    if ('+-*/()'.includes(ch)) {
      tokens.push(ch as Token);
      i += 1;
      continue;
    }
    return null;
  }

  let pos = 0;

  const factor = (): Dimension | null => {
    const token = tokens[pos++];
    if (token === 'time' || token === 'scalar') return token;
    if (token === '-') return factor();
    if (token === '(') {
      const inner = expr();
      return tokens[pos++] === ')' ? inner : null;
    }
    return null;
  };

  const term = (): Dimension | null => {
    let left = factor();
    while (left && (tokens[pos] === '*' || tokens[pos] === '/')) {
      const op = tokens[pos++];
      const right = factor();
      if (!right) return null;
      if (op === '*') {
        if (left === 'time' && right === 'time') return null;
        left = left === 'time' || right === 'time' ? 'time' : 'scalar';
      } else if (right === 'time') {
        if (left !== 'time') return null;
        left = 'scalar';
      }
    }
    return left;
  };

  const expr = (): Dimension | null => {
    const left = term();
    while (left && (tokens[pos] === '+' || tokens[pos] === '-')) {
      pos += 1;
      if (term() !== left) return null;
    }
    return left;
  };

  const result = expr();
  return pos === tokens.length ? result : null;
}

// Shows the answer as hours/minutes when the formula works out to a length of
// time; anything else is a plain number.
export function formatStatValue(
  value: number,
  expression: string,
  fields: FieldDefinition[],
): string {
  return formulaDimension(expression, fields) === 'time'
    ? formatDurationHours(value)
    : formatNumber(value);
}

export function entryWord(count: number): string {
  return `${count} ${count === 1 ? 'entry' : 'entries'}`;
}
