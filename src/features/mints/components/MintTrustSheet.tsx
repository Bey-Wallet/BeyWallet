import React, { forwardRef } from 'react';
import { XStack, YStack, View } from 'tamagui';
import AppBottomSheet, { type AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { MintImage } from '~/shared/ui/RemoteImage';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { ExternalLink } from '~/shared/icons';
import { BUIAppearanceProvider, useBUIOverlayAppearance } from '~/shared/ui/BUI/useBUITheme';
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
    onPreview: () => void;
    onClose?: () => void;
    onConfirm: () => void | Promise<void>;
  }
>(function MintTrustSheet({ mint, busy, error, onPreview, onClose, onConfirm }, ref) {
  const appearance = useBUIOverlayAppearance();
  const { data: info } = useMintInfo(mint?.url || '', {
    priority: 'interactive',
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
    <AppBottomSheet title="Trust this mint?" ref={ref} canDismiss={!busy} onClose={onClose}>
      <BUIAppearanceProvider value={appearance}>
        {mint && (
          <MintTrustContent
            mints={[{ url: mint.url, name }]}
            busy={busy}
            error={error}
            onConfirm={onConfirm}
            identity={
              <XStack items="center" gap="$2">
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
                <YStack flex={1} minWidth={0}>
                  <Text kind="label2">{name}</Text>
                  <Text color="$gray10" kind="body3" selectable>
                    {mint.url}
                  </Text>
                </YStack>
                <AppIconButton
                  accessibilityLabel="View mint preview"
                  emphasis="ghost"
                  size="small"
                  icon={<ExternalLink size={20} />}
                  disabled={busy}
                  onPress={onPreview}
                />
              </XStack>
            }
          />
        )}
      </BUIAppearanceProvider>
    </AppBottomSheet>
  );
});
