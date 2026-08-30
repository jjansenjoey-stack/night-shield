import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LoadingSpinner } from './LoadingSpinner';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

function classes({ variant = 'primary', size = 'md', block, className }: CommonProps) {
  return [
    'btn',
    `btn--${variant}`,
    size !== 'md' ? `btn--${size}` : '',
    block ? 'btn--block' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant,
  size,
  block,
  loading,
  icon,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={classes({ variant, size, block, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <LoadingSpinner size={15} /> : icon}
      {children}
    </button>
  );
}

interface LinkButtonProps extends CommonProps {
  to: string;
  state?: unknown;
  onClick?: () => void;
}

export function LinkButton({
  to,
  state,
  variant,
  size,
  block,
  icon,
  children,
  className,
  onClick,
}: LinkButtonProps) {
  return (
    <Link
      to={to}
      state={state as never}
      className={classes({ variant, size, block, className })}
      onClick={onClick}
    >
      {icon}
      {children}
    </Link>
  );
}

interface AnchorButtonProps extends CommonProps {
  href: string;
  download?: string;
  target?: string;
}

export function AnchorButton({
  href,
  download,
  target = '_blank',
  variant,
  size,
  block,
  icon,
  children,
  className,
}: AnchorButtonProps) {
  return (
    <a
      href={href}
      download={download}
      target={target}
      rel={target === '_blank' ? 'noreferrer noopener' : undefined}
      className={classes({ variant, size, block, className })}
    >
      {icon}
      {children}
    </a>
  );
}
