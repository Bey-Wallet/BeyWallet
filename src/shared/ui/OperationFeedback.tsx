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
import { XStack, YStack } from 'tamagui';
import { Spinner } from '~/shared/ui/Spinner';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';

type PendingOperation = { title: string; description: string };
type Registry = {
  update: (id: string, operation: PendingOperation) => void;
  remove: (id: string) => void;
};
const OperationContext = createContext<Registry | null>(null);

export function OperationFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [operations, setOperations] = useState<Record<string, PendingOperation>>({});
  const reducedMotion = useReducedMotion();
  const update = useCallback((id: string, operation: PendingOperation) => {
    setOperations((previous) => {
      if (
        previous[id]?.title === operation.title &&
        previous[id]?.description === operation.description
      )
        return previous;
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
          themeInverse
          bg="$gray4"
          rounded="$6"
          px="$4"
          py="$3"
          mt="$2"
          maxW={360}
          alignSelf="center"
        >
          <XStack items="center" gap="$3">
            <XStack
              aria-hidden
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Spinner size={20} reduceMotion={reducedMotion} />
            </XStack>
            <YStack flexShrink={1} accessibilityLiveRegion="polite" aria-live="polite" aria-atomic>
              <Toast.Title>{operation.title}</Toast.Title>
              <Toast.Description>{operation.description}</Toast.Description>
            </YStack>
          </XStack>
        </Toast>
      ))}
    </OperationContext.Provider>
  );
}

export function usePendingOperationToast({
  active,
  title,
  description,
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
    if (active && focused) registry?.update(id, { title, description });
    else registry?.remove(id);
  }, [registry, id, active, focused, title, description]);
  useEffect(() => () => registry?.remove(id), [registry, id]);
}
