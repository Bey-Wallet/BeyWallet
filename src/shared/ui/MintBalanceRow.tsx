import { MintImage } from '~/shared/ui/RemoteImage';
import { AppButton } from '~/shared/ui/AppButton';
import React from 'react';
import { XStack, YStack, Text, Avatar } from 'tamagui';
import { ChevronDown } from '@tamagui/lucide-icons';
import { ListTable } from '~/shared/ui/ListTable';
import { AppPressable } from '~/shared/ui/AppPressable';
import { appSpacing, appTypography } from '~/shared/theme/appearance';
import { Spinner } from '~/shared/ui/Spinner';
import { currencyService } from '~/services/wallet/currencyService';
import * as Haptics from 'expo-haptics';

interface MintBalanceRowProps {
  activeMint?: {
    icon?: string;
    name?: string;
    nickname?: string;
    mintUrl: string;
  } | null;
  activeMintUrl?: string;
  displayName?: string;
  label?: string;
  balance: number;
  showBalance?: boolean;
  children?: React.ReactNode;
  isLoadingMint?: boolean;
  isSelector?: boolean;
  onPress?: () => void;
  showMax?: boolean;
  onMaxPress?: () => void;
  maxDisabled?: boolean;
}

export function MintBalanceRow({
  activeMint,
  activeMintUrl,
  displayName,
  label,
  balance,
  showBalance = true,
  children,
  isLoadingMint = false,
  isSelector = true,
  onPress,
  showMax = false,
  onMaxPress,
  maxDisabled = false,
}: MintBalanceRowProps) {
  const resolvedDisplayName = React.useMemo(() => {
    if (displayName) return displayName;
    if (!activeMintUrl && !activeMint) return 'Select Mint';
    if (activeMint?.nickname) return activeMint.nickname;
    if (activeMint?.name) return activeMint.name;
    if (activeMint?.mintUrl) {
      return activeMint.mintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    }
    if (activeMintUrl) {
      return activeMintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    }
    return 'Select Mint';
  }, [displayName, activeMint, activeMintUrl]);

  const handlePress = () => {
    if (isSelector && onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
      onPress();
    }
  };

  return (
    <ListTable width="100%">
      <XStack items="center" gap={appSpacing.compact} px={appSpacing.gap}>
        <AppPressable
          flex={1}
          minWidth={0}
          minHeight={56}
          flexDirection="row"
          items="center"
          gap={appSpacing.compact}
          accessibilityRole={isSelector && onPress ? 'button' : 'text'}
          accessibilityLabel={`${label || 'Mint'}, ${resolvedDisplayName}${showBalance ? `, available ${currencyService.formatSats(balance)}` : ''}`}
          onPress={isSelector && onPress ? handlePress : undefined}
        >
          {isLoadingMint ? (
            <Spinner size="small" color="$color" />
          ) : (
            <Avatar rounded="$3" size={22} flexShrink={0}>
              <MintImage
                mintUrl={activeMint?.mintUrl}
                width="100%"
                height="100%"
                src={activeMint?.icon}
              />
            </Avatar>
          )}
          <YStack flex={1} minWidth={0}>
            {!!label && (
              <Text {...appTypography.body3} color="$gray10">
                {label}
              </Text>
            )}
            <Text {...appTypography.label2} color="$color" numberOfLines={1}>
              {isLoadingMint ? 'Loading…' : resolvedDisplayName}
            </Text>
          </YStack>
          {isSelector && onPress && <ChevronDown size={16} color="$gray10" />}
          {showBalance && (
            <YStack items="flex-end" flexShrink={1} minWidth={0}>
              <Text {...appTypography.label2} color="$color" textAlign="right">
                {currencyService.formatSats(balance)}
              </Text>
            </YStack>
          )}
        </AppPressable>
        {showBalance && showMax && (
          <AppButton
            variant="default"
            emphasis="secondary"
            size="xxsmall"
            onPress={onMaxPress}
            disabled={maxDisabled || balance === 0}
          >
            Max
          </AppButton>
        )}
      </XStack>
      {children}
    </ListTable>
  );
}
