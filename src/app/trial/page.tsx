import { requirePhase1PublicFeature } from '@/lib/phase1PublicGate';
import { TrialTest } from '@/components/TrialTest';

export default function TrialPage(){
  requirePhase1PublicFeature('publicPractice');
  return <TrialTest/>;
}
