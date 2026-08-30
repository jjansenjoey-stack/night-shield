import type { ReactNode } from 'react';
import { Compass } from 'lucide-react';

interface Props {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, message, action }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden="true">
        {icon ?? <Compass size={26} />}
      </div>
      <p className="empty-state__title">{title}</p>
      {message ? <p className="small" style={{ maxWidth: '40ch' }}>{message}</p> : null}
      {action}
    </div>
  );
}
