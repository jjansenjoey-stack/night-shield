interface Props {
  size?: number;
  label?: string;
}

export function LoadingSpinner({ size = 22, label }: Props) {
  return (
    <span
      className="spinner"
      style={{ width: size, height: size, borderWidth: Math.max(2, size / 8) }}
      role="status"
      aria-label={label ?? 'Loading'}
    />
  );
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="spinner-wrap">
      <LoadingSpinner size={30} label={label} />
      <span className="small">{label}</span>
    </div>
  );
}
