interface Props {
  className?: string;
}

/** Loading placeholder. Decorative: the container that loads sets `aria-busy`. */
export function Skeleton({ className = "" }: Props) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-panel bg-subtle motion-safe:animate-pulse ${className}`}
    />
  );
}
