import { useCountUp } from '@/lib/dashboard';

// A number that counts up on first paint (#350), formatted every frame.
// useCountUp skips the animation for users who prefer reduced motion.
export default function CountUp({
  value,
  format,
}: {
  value: number;
  format: (value: number) => string;
}) {
  return <>{format(useCountUp(value, 900, false))}</>;
}
