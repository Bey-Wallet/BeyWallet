import React, { forwardRef } from 'react';
import { XStack, YStack, View } from 'tamagui';
import AppBottomSheet, { type AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { MintImage } from '~/shared/ui/RemoteImage';
import { AppPressable } from '~/shared/ui/AppPressable';
import { BUICheckboxVisual } from '~/shared/ui/BUI/BUISelectionControl';
import { useMintInfo } from '~/shared/hooks/useMintInfo';
import { MintTrustContent } from './MintTrustContent';
import { MintText as Text } from './MintUI';

export type MintConnectionTarget = { url: string; name?: string; icon?: string };
const metadataText = (value: unknown) => (typeof value === 'string' ? value : undefined);

/** The same trust review is used from preview, mint-list quick add and Home suggestions. */
export const MintTrustSheet = forwardRef<
  AppBottomSheetRef,
  {
    mint: MintConnectionTarget | null;
    busy: boolean;
    error?: string | null;
    remember: boolean;
    onRememberChange: (checked: boolean) => void;
    onConfirm: () => void | Promise<void>;
  }
>(function MintTrustSheet({ mint, busy, error, remember, onRememberChange, onConfirm }, ref) {
  const { data: info } = useMintInfo(mint?.url || '', {
    enabled: !!mint && (!mint.name || !mint.icon),
  });
  let hostname = mint?.url || '';
  try {
    hostname = new URL(hostname).hostname;
  } catch {
    /* Keep the supplied URL as fallback. */
  }
  const name = mint?.name || metadataText(info?.name) || hostname;
  const icon =
    mint?.icon ||
    metadataText(info?.icon_url) ||
    metadataText(info?.picture) ||
    metadataText(info?.icon);
  return (
    <AppBottomSheet title="Trust this mint?" ref={ref} canDismiss={!busy}>
      {mint && (
        <MintTrustContent
          mints={[{ url: mint.url, name }]}
          busy={busy}
          error={error}
          onConfirm={onConfirm}
          identity={
            <XStack items="center" gap="$3">
              <View
                width={48}
                height={48}
                rounded="$6"
                overflow="hidden"
                bg="$gray3"
                flexShrink={0}
              >
                <MintImage mintUrl={mint.url} source={{ uri: icon, width: 48, height: 48 }} />
              </View>
              <YStack flex={1} minWidth={0} gap="$1">
                <Text kind="label2">{name}</Text>
                <Text color="$gray10" kind="body3" selectable>
                  {mint.url}
                </Text>
              </YStack>
            </XStack>
          }
        >
          <AppPressable
            self="center"
            minHeight={48}
            px="$3"
            flexDirection="row"
            items="center"
            gap="$1"
            accessibilityRole="checkbox"
            accessibilityLabel="Do not show again"
            accessibilityState={{ checked: remember, disabled: busy }}
            disabled={busy}
            onPress={() => onRememberChange(!remember)}
          >
            <View scale={0.75} opacity={0.8}>
              <BUICheckboxVisual checked={remember} disabled={busy} />
            </View>
            <Text kind="body3" color="$gray10">
              Do not show again
            </Text>
          </AppPressable>
        </MintTrustContent>
      )}
    </AppBottomSheet>
  );
});
