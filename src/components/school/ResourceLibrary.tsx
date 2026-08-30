'use client';
import { ResourceManagerV14 } from '@/components/evidara/resource-manager-v14';
export function ResourceLibrary({ studentMode = false }: { studentMode?: boolean }) {
  return <ResourceManagerV14 mode={studentMode ? 'student' : 'school'} />;
}
