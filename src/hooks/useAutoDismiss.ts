import { useEffect } from "react";

export function useAutoDismiss(
  message: string,
  clearMessage: (value: string) => void,
  delay = 5000,
) {
  useEffect(() => {
    if (!message) return;

    const timeoutId = window.setTimeout(() => {
      clearMessage("");
    }, delay);

    return () => window.clearTimeout(timeoutId);
  }, [clearMessage, delay, message]);
}
