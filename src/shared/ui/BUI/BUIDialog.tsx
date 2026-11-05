import React, { useEffect, useRef } from 'react';
import { Modal, ScrollView, useWindowDimensions } from 'react-native';
import { Theme, XStack, YStack } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppPressable } from '~/shared/ui/AppPressable';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';
import { useBUIStore } from '~/state/buiStore';
import { BUIText } from './BUIText';
import { useBUITheme } from './useBUITheme';

export type BUIAlertAction = { id: string; label: string; destructive?: boolean };
type BUIAlertProps = {
  title?: string;
  message: string;
  positive: BUIAlertAction;
  negative?: BUIAlertAction;
  onAction: (id: string) => void;
};

export function BUIAlertContent({ title, message, positive, negative, onAction }: BUIAlertProps) {
  const c = useBUITheme();
  return (
    <YStack rounded={20} bg={c.canvas} overflow="hidden">
      <YStack px={16} py={24} items="center">
        {!!title && (
          <BUIText kind="h3" textAlign="center" accessibilityRole="header">
            {title}
          </BUIText>
        )}
        <BUIText kind="body2" textAlign="center" mt={title ? 8 : 0}>
          {message}
        </BUIText>
      </YStack>
      <YStack height={0.5} bg={c.separator} />
      <XStack>
        {[...(negative ? [negative] : []), positive].map((action) => (
          <AppPressable
            key={action.id}
            flex={1}
            minHeight={56}
            px={8}
            py={12}
            items="center"
            justify="center"
            accessibilityLabel={action.label}
            onPress={() => onAction(action.id)}
            pressStyle={{ bg: c.highlighted }}
          >
            <BUIText
              kind="label1"
              textAlign="center"
              color={action.destructive ? c.negative : c.text}
            >
              {action.label}
            </BUIText>
          </AppPressable>
        ))}
      </XStack>
    </YStack>
  );
}

export function BUIDialog({
  visible,
  onDismiss,
  onAction,
  ...content
}: Omit<BUIAlertProps, 'onAction'> & {
  visible: boolean;
  onDismiss: () => void;
  onAction?: (id: string) => void;
}) {
  const c = useBUITheme();
  const appearance = useBUIStore((state) => state.appearance);
  const reducedMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const handled = useRef(false);
  useEffect(() => {
    if (visible) handled.current = false;
  }, [visible]);
  const dismiss = () => {
    if (!visible || handled.current) return;
    handled.current = true;
    onDismiss();
  };
  const choose = (id: string) => {
    if (!visible || handled.current) return;
    handled.current = true;
    onAction?.(id);
    onDismiss();
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'fade'}
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      <Theme name={appearance === 'light' ? 'light_bui' : 'dark_bui'}>
        <YStack
          flex={1}
          justify="center"
          items="center"
          pt={insets.top + 24}
          pb={insets.bottom + 24}
          pl={insets.left + 24}
          pr={insets.right + 24}
        >
          <AppPressable
            accessibilityLabel="Dismiss dialog"
            children={null}
            position="absolute"
            t={0}
            b={0}
            l={0}
            r={0}
            bg={c.overlayStrong}
            onPress={dismiss}
            pressStyle={{ opacity: 1 }}
          />
          <YStack
            width={Math.max(0, Math.min(560, width - insets.left - insets.right - 48))}
            maxHeight={Math.max(0, height - insets.top - insets.bottom - 48)}
            rounded={20}
            accessibilityViewIsModal
            style={{ elevation: 8 }}
          >
            <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
              <BUIAlertContent {...content} onAction={choose} />
            </ScrollView>
          </YStack>
        </YStack>
      </Theme>
    </Modal>
  );
}
