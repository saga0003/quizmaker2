import { redirect } from 'next/navigation';
import type { AppView } from '@/store/use-app-store';

type SearchParams = Record<string, string | string[] | undefined>;

export async function redirectToWorkspace(
  view: AppView,
  searchParams?: Promise<SearchParams>,
  overrides: SearchParams = {},
): Promise<never> {
  const values = searchParams ? await searchParams : {};
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (key === 'view' || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else {
      params.set(key, value);
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    params.delete(key);
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else {
      params.set(key, value);
    }
  }

  params.set('view', view);
  redirect(`/?${params.toString()}`);
}
