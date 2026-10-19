import { useRef, useState } from 'react';
import { useSettingsBusy } from './useSettingsBusy';

export function useSettingsOperation() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const locked = useRef(false);
  useSettingsBusy(busy);
  const run = async (operation: () => Promise<string>) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setMessage(null);
    setError(false);
    try {
      setMessage(await operation());
    } catch {
      setError(true);
      setMessage('The operation could not be completed. Please try again.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const clear = () => {
    setMessage(null);
    setError(false);
  };
  return { busy, message, error, run, clear };
}
