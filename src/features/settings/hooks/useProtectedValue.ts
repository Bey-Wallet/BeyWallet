import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { biometricService } from '~/services/platform/biometricService';

/** Authentication belongs to the screen, so direct routes have the same protection. */
export function useProtectedValue<T>(reason: string, read: () => Promise<T>) {
  const [value, setValue] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const epoch = useRef(0);
  const locked = useRef(false);
  const hide = useCallback(() => {
    epoch.current++;
    locked.current = false;
    setValue(null);
    setBusy(false);
  }, []);
  useFocusEffect(
    useCallback(() => {
      hide();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'background') hide();
      });
      return () => {
        subscription.remove();
        hide();
      };
    }, [hide]),
  );

  const reveal = async () => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    const current = ++epoch.current;
    try {
      const authorized = await biometricService.authenticateAsync(reason);
      if (current !== epoch.current) return;
      if (!authorized) {
        setError('Authentication was cancelled or unsuccessful.');
        return;
      }
      const result = await read();
      if (current === epoch.current) setValue(result);
    } catch {
      if (current === epoch.current)
        setError('Could not access this information. Please try again.');
    } finally {
      if (current === epoch.current) {
        locked.current = false;
        setBusy(false);
      }
    }
  };
  return { value, busy, error, reveal, hide };
}
