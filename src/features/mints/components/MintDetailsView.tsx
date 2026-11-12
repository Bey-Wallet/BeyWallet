import React from 'react';
import { ScrollView, XStack, YStack } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppPressable } from '~/shared/ui/AppPressable';
import { MintImage } from '~/shared/ui/RemoteImage';
import { appSpacing, appTypography } from '~/shared/theme/appearance';
import { MintText as Text } from './MintUI';
import { MintOverview } from './MintOverview';
import { MintQuickActions } from './MintQuickActions';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { QrCode, RefreshCw } from '@tamagui/lucide-icons';

export type MintConnection = 'online' | 'offline' | 'checking';

/** Common mint presentation; callers retain ownership of wallet operations. */
export function MintDetailsView({
  url,
  name,
  icon,
  info,
  connection,
  connectionCheckedAt,
  onRecheck,
  onCopyUrl,
  balance,
  badges,
  onQr,
  onRestore,
  restoring,
  restoreDisabled,
  bottomAction,
  primaryAction,
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
  onQr: () => void;
  onRestore?: () => void;
  restoring?: boolean;
  restoreDisabled?: boolean;
  bottomAction?: React.ReactNode;
  primaryAction?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const connectionControl = (
    <XStack items="center" gap="$1">
      <XStack
        rounded={100}
        px="$3"
        py="$1"
        bg={connection === 'online' ? '$green3' : connection === 'offline' ? '$red3' : '$gray3'}
      >
        <Text
          kind="label3"
          color={
            connection === 'online' ? '$green11' : connection === 'offline' ? '$red11' : '$gray10'
          }
          accessibilityLiveRegion="polite"
        >
          {connection === 'online' ? 'Online' : connection === 'offline' ? 'Offline' : 'Checking…'}
        </Text>
      </XStack>
      <AppIconButton
        emphasis="ghost"
        size="xxsmall"
        icon={RefreshCw}
        accessibilityLabel="Recheck mint connection"
        loadingText="Checking mint connection…"
        loading={connection === 'checking'}
        disabled={connection === 'checking'}
        onPress={onRecheck}
      />
    </XStack>
  );
  return (
    <ScrollView
      flex={1}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + appSpacing.group }}
    >
      <YStack px={appSpacing.page} pt={appSpacing.group} gap={appSpacing.group}>
        <YStack gap={appSpacing.page}>
          {balance && (
            <XStack items="center" justify="space-between" gap="$2" flexWrap="wrap">
              <XStack gap="$2" items="center" flexWrap="wrap">
                {badges}
              </XStack>
              {connectionControl}
            </XStack>
          )}
          <XStack items="center" gap={appSpacing.gap}>
            {balance ? (
              <YStack gap="$1" flex={1} minWidth={0}>
                <Text kind="body2" color="$gray10">
                  Mint balance
                </Text>
                <Text
                  kind="num1"
                  {...appTypography.display}
                  color="$color"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {balance.amount}
                  {balance.unit && <Text kind="label2">{` ${balance.unit}`}</Text>}
                </Text>
                {balance.secondary && (
                  <Text kind="label2" color="$gray10">
                    {balance.secondary}
                  </Text>
                )}
              </YStack>
            ) : null}
            <MintImage
              mintUrl={url}
              src={icon}
              width={64}
              height={64}
              rounded="$6"
              flexShrink={0}
            />
            {!balance && (
              <YStack flex={1} minWidth={0}>
                <AppPressable
                  minWidth={0}
                  minHeight={48}
                  justify="center"
                  gap="$1"
                  accessibilityLabel="Copy mint URL"
                  onPress={onCopyUrl}
                >
                  <Text kind="h3">{name}</Text>
                  <Text kind="body2" color="$gray10" numberOfLines={1} ellipsizeMode="middle">
                    {url}
                  </Text>
                </AppPressable>
                {connectionControl}
              </YStack>
            )}
            {!balance && (
              <AppIconButton
                emphasis="secondary"
                size="medium"
                icon={<QrCode size={22} />}
                accessibilityLabel="Show mint QR code"
                onPress={onQr}
              />
            )}
          </XStack>
        </YStack>
        {primaryAction}
        {balance && (
          <MintQuickActions
            onQr={onQr}
            onRestore={onRestore}
            restoring={restoring}
            restoreDisabled={restoreDisabled}
          />
        )}
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
