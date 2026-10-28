import React, {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  useCallback,
} from 'react';
import { Toast } from '@tamagui/toast';
import { NavigationContext } from '@react-navigation/native';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ToastContent, toastSurfaceProps } from './ToastContent';
import { getToastLayout } from './toastLayout';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';

type PendingOperation = { title: string };
type Registry = {
  update: (id: string, operation: PendingOperation) => void;
  remove: (id: string) => void;
};
const OperationContext = createContext<Registry | null>(null);

export function OperationFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [operations, setOperations] = useState<Record<string, PendingOperation>>({});
  const reducedMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = getToastLayout(width, insets);
  const update = useCallback((id: string, operation: PendingOperation) => {
    setOperations((previous) => {
      if (previous[id]?.title === operation.title) return previous;
      return { ...previous, [id]: operation };
    });
  }, []);
  const remove = useCallback((id: string) => {
    setOperations((previous) => {
      if (!(id in previous)) return previous;
      const next = { ...previous };
      delete next[id];
      return next;
    });
  }, []);
  const registry = useMemo(() => ({ update, remove }), [update, remove]);
  return (
    <OperationContext.Provider value={registry}>
      {children}
      {Object.entries(operations).map(([id, operation]) => (
        <Toast
          key={id}
          open
          duration={Infinity}
          type="background"
          pointerEvents="none"
          onOpenChange={() => {}}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onSwipeStart={(event) => event.preventDefault()}
          onSwipeMove={(event) => event.preventDefault()}
          onSwipeEnd={(event) => event.preventDefault()}
          {...toastSurfaceProps}
          animation={reducedMotion ? undefined : 'quick'}
          maxW={layout.width}
        >
          <ToastContent kind="loading" title={operation.title} maxWidth={layout.width} />
        </Toast>
      ))}
    </OperationContext.Provider>
  );
}

export function usePendingOperationToast({
  active,
  title,
}: PendingOperation & { active: boolean }) {
  const registry = useContext(OperationContext);
  const id = useId();
  const navigation = useContext(NavigationContext);
  const [focused, setFocused] = useState(() => navigation?.isFocused() ?? true);
  useEffect(() => {
    if (!navigation) return;
    setFocused(navigation.isFocused());
    const focus = navigation.addListener('focus', () => setFocused(true));
    const blur = navigation.addListener('blur', () => {
      registry?.remove(id);
      setFocused(false);
    });
    return () => {
      focus();
      blur();
    };
  }, [navigation, registry, id]);
  useEffect(() => {
    if (active && focused) registry?.update(id, { title });
    else registry?.remove(id);
  }, [registry, id, active, focused, title]);
  useEffect(() => () => registry?.remove(id), [registry, id]);
}
