import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'pink' | 'teal' | 'success' | 'warning' | 'error';

interface Props {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  title?: string;
  className?: string;
}

export function Badge({ tone = 'neutral', icon, children, title, className }: Props) {
  return (
    <span className={['badge', `badge--${tone}`, className ?? ''].filter(Boolean).join(' ')} title={title}>
      {icon}
      {children}
    </span>
  );
}
