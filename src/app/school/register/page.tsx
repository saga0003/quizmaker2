import type { Metadata } from 'next';

import { InstitutionRegisterPage } from '@/components/evidara/institution-register-page';

export const metadata: Metadata = {
  title: 'Register your institution · Evidara',
  description:
    'Create your school, college or coaching workspace on Evidara: question banks, paper building, secure online exams and per-student analytics.',
};

export default function RegisterSchool() {
  return <InstitutionRegisterPage />;
}
