import { useCallback, useEffect, useRef, useState } from 'react';

export interface ToastMessage {
  id: number;
  text: string;
  tone: 'success' | 'info' | 'error';
}

const DEFAULT_TOAST_DURATION_MS = 3500;

/**
 * Manages transient accessible toast notifications with automatic timeout cleanup on unmount.
 */
export function useToast(durationMs = DEFAULT_TOAST_DURATION_MS) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const dismissToast = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback(
    (text: string, tone: ToastMessage['tone'] = 'success') => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      const id = Date.now();
      setToast({ id, text, tone });
      timerRef.current = window.setTimeout(() => {
        setToast((current) => (current?.id === id ? null : current));
        timerRef.current = null;
      }, durationMs);
    },
    [durationMs]
  );

  return { toast, showToast, dismissToast };
}
