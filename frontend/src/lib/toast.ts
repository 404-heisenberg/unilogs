import { toast as sonnerToast } from 'sonner';

// Thin wrapper around sonner so call sites never import it directly - keeps
// the toast library swappable, and centralizes turning a caught mutation
// error into a readable message (api.ts's ApiError already carries a
// sensible one on `.message`; anything else falls back to a generic string).
function messageFor(input: unknown, fallback: string): string {
  if (typeof input === 'string') return input;
  if (input instanceof Error && input.message) return input.message;
  return fallback;
}

type ToastAction = { label: string; onClick: () => void };

type ToastOptions = {
  description?: string;
  action?: ToastAction;
  fallback?: string;
};

export const toast = {
  success: (message: string, options: Omit<ToastOptions, 'fallback'> = {}) =>
    sonnerToast.success(message, options),
  error: (input: unknown, options: ToastOptions = {}) =>
    sonnerToast.error(
      messageFor(input, options.fallback ?? 'Something went wrong. Please try again.'),
      {
        description: options.description,
        action: options.action,
      },
    ),
  info: (message: string, options: Omit<ToastOptions, 'fallback'> = {}) =>
    sonnerToast.info(message, options),
};
