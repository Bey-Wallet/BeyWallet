import React from 'react';
import { ScrollView, XStack, YStack } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Copy } from '~/shared/icons';
import { AppPressable } from '~/shared/ui/AppPressable';
import { AppText } from '~/shared/ui/AppText';
import { MintImage } from '~/shared/ui/RemoteImage';
import { appSpacing } from '~/shared/theme/appearance';
import { MintOverview } from './MintOverview';
import { MintQuickActions } from './MintQuickActions';

export type MintConnection = 'online' | 'offline' | 'checking';

/** Full mint pages use the sheet's layout language; their controllers keep all operations. */
export function MintDetailsView({
  url,
  icon,
  info,
  connection,
  connectionCheckedAt,
  onRecheck,
  onCopyUrl,
  balance,
  badges,
  onTransfer,
  transferDisabled,
  onRestore,
  restoring,
  restoreDisabled,
  bottomAction,
}: {
  url: string;
  name: string;
  icon?: string;
  info: Record<string, any>;
  connection: MintConnection;
  connectionCheckedAt?: number;
  onRecheck: () => void;
  onCopyUrl: () => void;
  balance?: { amount: string; unit?: string; secondary?: string };
  badges?: React.ReactNode;
  onTransfer?: () => void;
  transferDisabled?: boolean;
  onRestore?: () => void;
  restoring?: boolean;
  restoreDisabled?: boolean;
  bottomAction?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const mintIcon = (
    <YStack width={72} height={72} rounded="$6" overflow="hidden" flexShrink={0}>
      <MintImage mintUrl={url} src={icon} width={72} height={72} rounded="$6" />
    </YStack>
  );
  return (
    <ScrollView
      flex={1}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + appSpacing.page }}
    >
      <YStack px={appSpacing.page} pt="$4" gap="$5">
        {balance ? (
          <XStack items="center" gap="$4" justify="space-between">
            <YStack gap="$1" flex={1} minWidth={0}>
              <XStack gap="$2" items="baseline" flexWrap="wrap">
                <AppText variant="display" numberOfLines={1} adjustsFontSizeToFit flexShrink={1}>
                  {balance.amount}
                </AppText>
                {!!balance.unit && <AppText tone="secondary">{balance.unit}</AppText>}
              </XStack>
              {!!balance.secondary && (
                <AppText variant="body1" tone="secondary">
                  {balance.secondary}
                </AppText>
              )}
            </YStack>
            {mintIcon}
          </XStack>
        ) : (
          <YStack items="center" gap="$2">
            {mintIcon}
            <AppPressable
              width="100%"
              minWidth={0}
              minHeight={48}
              justify="center"
              gap="$1"
              accessibilityLabel="Copy mint URL"
              onPress={onCopyUrl}
            >
              <XStack gap="$1" items="center" justify="center">
                <AppText
                  variant="body3"
                  tone="secondary"
                  numberOfLines={1}
                  ellipsizeMode="middle"
                  flexShrink={1}
                  textAlign="center"
                >
                  {url}
                </AppText>
                <Copy size={12} color="$gray10" />
              </XStack>
            </AppPressable>
          </YStack>
        )}
        {badges && (
          <XStack gap="$2" items="center" flexWrap="wrap">
            {badges}
          </XStack>
        )}
        <MintQuickActions
          onTransfer={onTransfer}
          transferDisabled={transferDisabled}
          onRestore={onRestore}
          restoring={restoring}
          restoreDisabled={restoreDisabled}
        />
        <MintOverview
          url={url}
          info={info}
          connection={connection}
          connectionCheckedAt={connectionCheckedAt}
          onRecheck={onRecheck}
        />
        {bottomAction}
      </YStack>
    </ScrollView>
  );
}
