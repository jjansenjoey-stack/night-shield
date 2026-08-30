import { getProvider } from './dataProvider';
import type { CommunitySubmission, SubmissionType } from '@/types';

export async function submitContent(
  type: SubmissionType,
  submittedBy: string,
  submitterName: string | null,
  content: Record<string, unknown>,
): Promise<CommunitySubmission> {
  const provider = await getProvider();
  return provider.submitContent(type, submittedBy, submitterName, content);
}

export async function getPendingSubmissions(): Promise<CommunitySubmission[]> {
  const provider = await getProvider();
  return provider.getPendingSubmissions();
}

export async function getSubmissionsByUser(userId: string): Promise<CommunitySubmission[]> {
  const provider = await getProvider();
  return provider.getSubmissionsByUser(userId);
}

export async function approveSubmission(
  id: string,
  moderatorId: string,
): Promise<CommunitySubmission> {
  const provider = await getProvider();
  return provider.approveSubmission(id, moderatorId);
}

export async function rejectSubmission(
  id: string,
  moderatorId: string,
  notes: string,
): Promise<CommunitySubmission> {
  const provider = await getProvider();
  return provider.rejectSubmission(id, moderatorId, notes);
}

export const SUBMISSION_TYPE_LABELS: Record<SubmissionType, string> = {
  installation: 'Public art',
  event: 'Event',
  third_space: 'Third space',
};
