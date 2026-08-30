import { redirectToWorkspace } from '@/lib/workspaceRedirect';

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function LegacyWorkspaceRedirect({ searchParams }: Props) {
  return redirectToWorkspace('admin-subscriptions', searchParams);
}
