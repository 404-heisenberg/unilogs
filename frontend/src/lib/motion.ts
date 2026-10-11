import type { CSSProperties } from 'react';

// Card stagger (#350): each card in a list rises in a beat after the one
// before it. The delay is capped so a long list settles quickly, and
// motion-reduce turns the animation off entirely.
export const CARD_IN = 'animate-card-in motion-reduce:animate-none';

const STEP_MS = 40;
const MAX_STEPS = 8;

export function staggerDelay(index: number): CSSProperties {
  return { animationDelay: `${Math.min(index, MAX_STEPS) * STEP_MS}ms` };
}
