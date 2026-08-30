import type { HTMLAttributes, ReactNode } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  flush?: boolean;
  children: ReactNode;
}

export function Card({ flush, className, children, ...rest }: Props) {
  return (
    <div
      className={['card', flush ? 'card--flush' : '', className ?? ''].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}

interface ClickableProps extends HTMLAttributes<HTMLDivElement> {
  flush?: boolean;
  onSelect: () => void;
  /** What the control announces. Falls back to a generic label. */
  label?: string;
  /** Position in its list — drives the staggered entrance. Omit for no animation. */
  index?: number;
  children: ReactNode;
}

/**
 * A card whose whole surface is clickable.
 *
 * The card itself is an <article>, not a <button>: these cards contain
 * headings, paragraphs and lists, and a button strips all of that structure
 * from the accessibility tree (and is invalid HTML besides). Instead one real
 * button is stretched over the card — keyboard reachable, announced with a
 * proper name, with the content still readable as content underneath.
 */
export function ClickableCard({
  flush,
  onSelect,
  label,
  index,
  className,
  style,
  children,
  ...rest
}: ClickableProps) {
  return (
    <article
      className={[
        'card',
        'card--interactive',
        'card--stretch',
        index != null ? 'card-enter' : '',
        flush ? 'card--flush' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      // Staggers the entrance. Capped so a long list still finishes quickly.
      style={index != null ? { ...style, ['--i' as string]: Math.min(index, 12) } : style}
      {...rest}
    >
      <button type="button" className="card__stretch" onClick={onSelect}>
        <span className="sr-only">{label ?? 'Open details'}</span>
      </button>
      {children}
    </article>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="section">
      <div className="section__head">
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
