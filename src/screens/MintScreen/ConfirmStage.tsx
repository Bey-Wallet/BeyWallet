import React, { useMemo } from 'react';
import { YStack, XStack, Text, Button, View, Separator, ScrollView, YGroup, Avatar } from 'tamagui';
import { Sprout, Zap, ShieldCheck } from '@tamagui/lucide-icons';
import { Spinner } from '~/components/UI/Spinner';
import { ProcessingSheet } from '~/components/UI/ProcessingSheet';
import { useWalletStore } from '~/store/walletStore';
import { useSettingsStore } from '~/store/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/bitcoinService';
import { currencyService, CurrencyCode, SUPPORTED_CURRENCIES } from '~/services/currencyService';
import { mintManager } from '~/services/core';
import * as Haptics from 'expo-haptics';

interface ConfirmStageProps {
  amount: string;
  mintUrl: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

export function ConfirmStage({ amount, mintUrl, isLoading, onConfirm, onBack }: ConfirmStageProps) {
  const sats = parseInt(amount, 10) || 0;
  const { mints } = useWalletStore();
  const { secondaryCurrency, showBitcoinSymbol } = useSettingsStore();

  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
  });

  // Fetch the mint's keyset fee (input_fee_ppk). Minting creates fresh proofs
  // with no input proofs consumed, so the per-proof fee doesn't apply directly.
  // We show the mint's fee policy so the user knows what rate this mint charges.
  const { data: feePpk = 0 } = useQuery({
    queryKey: ['mintFeePpk', mintUrl],
    queryFn: () => mintManager.getFeePpk(mintUrl),
    staleTime: 5 * 60 * 1000, // 5 min
    enabled: !!mintUrl,
  });

  const feeDisplay = useMemo(() => {
    if (!feePpk || feePpk <= 0) return '0 SATS (Free)';
    // feePpk is fee in parts-per-thousand per proof (NUT-02)
    const estimatedFee = Math.ceil((sats * feePpk) / 1000);
    return estimatedFee > 0 ? `~${estimatedFee} SATS` : '0 SATS (Free)';
  }, [feePpk, sats]);

  const currencySymbol = useMemo(() => {
    return SUPPORTED_CURRENCIES.find((c) => c.code === secondaryCurrency)?.symbol || '$';
  }, [secondaryCurrency]);

  const fiatValue = useMemo(() => {
    if (!btcData?.price) return '0.00';
    const fiat = currencyService.convertSatsToCurrency(sats, btcData.price);
    return currencyService.formatValue(fiat, secondaryCurrency as CurrencyCode);
  }, [sats, btcData?.price, secondaryCurrency]);

  const normalizeUrl = (url: string) => url.replace(/\/$/, '');

  const activeMint = useMemo(() => {
    if (!mintUrl) return null;
    return mints.find((m) => normalizeUrl(m.mintUrl) === normalizeUrl(mintUrl));
  }, [mints, mintUrl]);

  const mintDisplayName = useMemo(() => {
    if (!mintUrl) return 'Selected Mint';
    if (activeMint?.nickname) return activeMint.nickname;
    if (activeMint?.name) return activeMint.name;
    return mintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }, [activeMint, mintUrl]);

  const formattedSatsString = useMemo(() => {
    return sats.toLocaleString('en-US');
  }, [sats]);

  return (
    <YStack flex={1} bg="$background">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 180 } as any}
        showsVerticalScrollIndicator={false}
      >
        <YStack gap="$4">
          {/* Middle Amount Display */}
          <YStack gap="$3" py="$6" items="center" justify="center">
            <Text fontSize={52} fontWeight="700" color="$accent3" lineHeight={54}>
              +{showBitcoinSymbol ? `₿${formattedSatsString}` : `${formattedSatsString} SATS`}
            </Text>
            <Text color="$accent5" fontWeight="600" fontSize={16}>
              ≈ {fiatValue} {secondaryCurrency}
            </Text>
          </YStack>

          {/* Send Method Badge */}
          <XStack self="center" items="center" gap="$2" bg="$accent9" px="$4" py="$3" rounded="$10">
            <Zap size={16} color="white" />
            <Text fontSize="$3" fontWeight="700" color="white">
              Top Up via Lightning
            </Text>
          </XStack>

          {/* Details List */}
          <YStack bg="$gray2" rounded="$6" overflow="hidden" mb="$3">
            <View p="$3" px="$4">
              <Text fontSize="$3" fontWeight="700" color="$gray12">
                Details
              </Text>
            </View>
            <Separator borderColor="$borderColor" opacity={0.3} />
            <YGroup separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
              <DetailItem
                label="Mint"
                value={mintDisplayName}
                icon={
                  <Avatar rounded="$3" size="$1.5">
                    <Avatar.Image src={activeMint?.icon} />
                    <Avatar.Fallback bg="$green3" items="center" justify="center">
                      <Sprout size={12} color="$green10" />
                    </Avatar.Fallback>
                  </Avatar>
                }
              />
              <DetailItem label="Method" value="Top Up via Lightning" icon={<Zap size={16} />} />
              <DetailItem label="Estimated Fee" value={feeDisplay} />
            </YGroup>
          </YStack>
        </YStack>
      </ScrollView>

      {/* Action Buttons */}
      <YStack position="absolute" justify="space-between" b="$4" l="$1" r="$1" gap="$2">
        <Button
          chromeless
          flex={1}
          color="$color"
          size="$5"
          height={55}
          rounded="$12"
          fontWeight="800"
          disabled={isLoading}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onBack();
          }}
        >
          Go Back
        </Button>
        <Button
          theme="accent"
          flex={1}
          size="$5"
          height={55}
          rounded="$12"
          fontWeight="800"
          disabled={isLoading}
          icon={isLoading ? <Spinner size="small" color="$color" /> : undefined}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onConfirm();
          }}
        >
          {isLoading ? 'Creating...' : 'Confirm'}
        </Button>
      </YStack>

      <ProcessingSheet
        visible={!!isLoading}
        title="Creating Invoice"
        amount={sats}
        detail={`Requesting from ${mintDisplayName}`}
      />
    </YStack>
  );
}

function DetailItem({
  label,
  value,
  icon,
  valueColor,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <XStack justify="space-between" items="center" py="$3" px="$4">
      <Text fontSize="$3" color="$gray10" fontWeight="600">
        {label}
      </Text>
      <XStack gap="$2" items="center">
        {icon}
        <Text
          fontSize="$3"
          fontWeight="800"
          color={valueColor || '$color'}
          numberOfLines={1}
          style={{ maxWidth: 220 }}
        >
          {value}
        </Text>
      </XStack>
    </XStack>
  );
}
