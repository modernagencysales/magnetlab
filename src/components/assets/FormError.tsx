'use client';

interface FormErrorProps {
  message: string | null;
  onDismiss?: () => void;
}

export function FormError({ message, onDismiss }: FormErrorProps): JSX.Element | null {
  if (!message) return null;

  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
      {message}
      {onDismiss && (
        <button onClick={onDismiss} className="ml-2 underline">
          Dismiss
        </button>
      )}
    </div>
  );
}
