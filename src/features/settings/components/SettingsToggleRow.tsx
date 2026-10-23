import React, { useRef, useState } from 'react';
import { Text, XStack, YStack } from 'tamagui';
import * as Haptics from 'expo-haptics';
import { AppSwitch } from '~/shared/ui/AppSwitch';
import type { AppButtonIcon } from '~/shared/ui/AppButton';
import { appTypography } from '~/shared/theme/appearance';
import { useSettingsBusy } from '../hooks/useSettingsBusy';

export function SettingsToggleRow({
  title,
  description,
  icon: Icon,
  checked,
  save,
  requiresApproval = false,
}: {
  title: string;
  description?: string;
  icon: AppButtonIcon;
  checked: boolean;
  save: (next: boolean) => Promise<void>;
  requiresApproval?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState<boolean | undefined>();
  const locked = useRef(false);
  const queued = useRef<boolean | undefined>(undefined);
  useSettingsBusy(busy);

  const toggle = async (next: boolean) => {
    if (requiresApproval && locked.current) return;
    if (!requiresApproval) setPending(next);
    queued.current = next;
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(false);
    try {
      while (queued.current !== undefined) {
        const value = queued.current;
        queued.current = undefined;
        await save(value);
      }
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      queued.current = undefined;
      setError(true);
    } finally {
      locked.current = false;
      setPending(undefined);
      setBusy(false);
    }
  };

  return (
    <YStack>
      <AppSwitch
        checked={pending ?? checked}
        onCheckedChange={toggle}
        disabled={requiresApproval && busy}
        variant="branded"
        accessibilityLabel={[title, description].filter(Boolean).join(', ')}
      >
        <XStack width={20} items="center" justify="center" aria-hidden>
          {React.isValidElement(Icon)
            ? React.cloneElement(Icon as React.ReactElement<any>, { size: 20, color: '$color' })
            : React.createElement(Icon as React.ComponentType<any>, {
                size: 20,
                color: '$color',
                strokeWidth: 1.8,
              })}
        </XStack>
        <YStack flex={1} gap="$1">
          <Text {...appTypography.label2} color="$color">
            {title}
          </Text>
          {description && (
            <Text {...appTypography.body3} color="$gray10">
              {description}
            </Text>
          )}
        </YStack>
      </AppSwitch>
      {error && (
        <Text
          {...appTypography.body3}
          color="$red10"
          px="$4"
          pb="$2"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          Could not update this setting. Please try again.
        </Text>
      )}
    </YStack>
  );
}
