import { MintImage } from '~/shared/ui/RemoteImage';
import { AppButton } from '~/shared/ui/AppButton';
import React from 'react';
import { XStack, Text, Avatar } from 'tamagui';
import { ChevronDown } from '@tamagui/lucide-icons';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
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
      <ListTableRow
        label={label || 'Mint'}
        onPress={isSelector && onPress ? handlePress : undefined}
        value={
          <XStack gap="$2" items="center" flexShrink={1} minWidth={0}>
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
            <Text
              fontFamily="$body"
              fontSize={14}
              fontWeight="500"
              color="$color"
              textAlign="right"
              flexShrink={1}
            >
              {isLoadingMint ? 'Loading…' : resolvedDisplayName}
            </Text>
          </XStack>
        }
        rightContent={isSelector && onPress ? <ChevronDown size={16} color="$gray10" /> : undefined}
      />
      <ListTableRow
        label="Available balance"
        value={currencyService.formatSats(balance)}
        rightContent={
          showMax ? (
            <AppButton
              variant="default"
              emphasis="secondary"
              size="xxsmall"
              onPress={onMaxPress}
              disabled={maxDisabled || balance === 0}
            >
              Max
            </AppButton>
          ) : undefined
        }
      />
    </ListTable>
  );
}
