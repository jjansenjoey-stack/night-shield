import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppStore } from '@/store/appStore';
import { LoadingBlock } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/Button';
import { canUserPerformAction, type Action } from '@/lib/permissions';
import { Lock } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Extra gate on top of "is signed in" — e.g. only organizers. */
  requires?: Action;
}

/**
 * Prompts 18 & 20 — Discover and Events stay open to guests; anything that
 * writes on someone's behalf needs a session.
 */
export function PrivateRoute({ children, requires }: Props) {
  const user = useAppStore((s) => s.user);
  const authReady = useAppStore((s) => s.authReady);
  const location = useLocation();

  if (!authReady) return <LoadingBlock label="Checking your session…" />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (requires && !canUserPerformAction(user, requires)) {
    return (
      <div className="page">
        <EmptyState
          icon={<Lock size={24} />}
          title="You don't have access to this yet"
          message="This part of Night Shield is for organizers and moderators. If you run events in Tilburg, the Inclusivity Department can upgrade your account."
          action={
            <LinkButton to="/profile" variant="text">
              Back to your profile
            </LinkButton>
          }
        />
      </div>
    );
  }

  return <>{children}</>;
}
