import { redirect } from 'next/navigation';
import { PHASE1_LAUNCH } from '@/config/phase1-launch';

export type Phase1PublicFeature =
  | 'publicPractice'
  | 'publicQuestionPages'
  | 'publicQuestionPapers'
  | 'publicTestSeries'
  | 'publicProducts';

export function requirePhase1PublicFeature(feature: Phase1PublicFeature) {
  if (!PHASE1_LAUNCH[feature]) redirect('/');
}
