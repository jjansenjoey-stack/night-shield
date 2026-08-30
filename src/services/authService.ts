import { getProvider } from './dataProvider';
import type { UserProfile } from '@/types';

export async function signupUser(email: string, password: string): Promise<UserProfile> {
  const provider = await getProvider();
  return provider.signUp(email, password);
}

export async function loginUser(email: string, password: string): Promise<UserProfile> {
  const provider = await getProvider();
  return provider.signIn(email, password);
}

export async function logoutUser(): Promise<void> {
  const provider = await getProvider();
  return provider.signOut();
}

export async function fetchCurrentUser(): Promise<UserProfile | null> {
  const provider = await getProvider();
  return provider.getCurrentUser();
}

export async function requestPasswordReset(email: string): Promise<void> {
  const provider = await getProvider();
  return provider.requestPasswordReset(email);
}

export async function updatePassword(newPassword: string): Promise<void> {
  const provider = await getProvider();
  return provider.updatePassword(newPassword);
}

export async function updateUserProfile(
  userId: string,
  patch: Partial<UserProfile>,
): Promise<UserProfile> {
  const provider = await getProvider();
  return provider.updateProfile(userId, patch);
}

/** Shape auth errors into something worth showing a person. */
export function readableAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes('already registered') || lower.includes('already exists')) {
    return 'An account with this email already exists. Try logging in instead.';
  }
  if (lower.includes('invalid login') || lower.includes('invalid email or password')) {
    return 'Invalid email or password.';
  }
  if (lower.includes('password') && lower.includes('short')) {
    return 'That password is too short — use at least 8 characters.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Check your inbox and confirm your email address first.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  return message;
}
