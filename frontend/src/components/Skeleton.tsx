// Shared loading placeholder. `rows` draws a stack of skeleton bars; tweak each
// bar's height/radius/colour with `barClassName`. `className` styles the wrapper
// (grid/flex layout). Every loader in the app should use this so they look the same.
type SkeletonProps = {
  rows?: number;
  barClassName?: string;
  className?: string;
};

export default function Skeleton({
  rows = 3,
  barClassName = 'h-4',
  className = '',
}: SkeletonProps) {
  return (
    <div aria-hidden className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={`animate-pulse rounded bg-cream ${barClassName}`} />
      ))}
    </div>
  );
}
