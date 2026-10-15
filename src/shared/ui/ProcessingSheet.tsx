import { AppButton } from '~/shared/ui/AppButton';
import React, { useEffect, useRef } from 'react';
import { YStack, XStack, Text, View, Theme, useTheme, Separator, YGroup } from 'tamagui';
import {
  Check,
  CheckCircle2,
  XCircle,
  Clock,
  Landmark,
  Zap,
  User,
  Wifi,
  Copy,
} from '@tamagui/lucide-icons';
import AppBottomSheet, { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { Spinner } from '~/shared/ui/Spinner';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Image } from 'tamagui';
import { useSettingsStore } from '~/state/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/api/bitcoinService';
import { currencyService, CurrencyCode } from '~/services/wallet/currencyService';
import { ActivityIndicator } from 'react-native';

const nostrIconWhite = require('~/assets/images/nostr-icon-white-transparent.png');

export type ProcessingVariant = 'standard' | 'nostr';

export type ProcessingStatus = 'processing' | 'success' | 'error';

interface ProcessingSheetProps {
  visible: boolean;
  status?: ProcessingStatus;
  title: string;
  amount?: number;
  detail?: string | React.ReactNode;
  errorMessage?: string;
  onClose?: () => void;
  onRetry?: () => void;
  onViewDetails?: () => void;
  // Extra details for success state
  mintUrl?: string;
  type?: 'p2pk' | 'standard';
  recipient?: string;
  direction?: 'send' | 'receive';
  variant?: ProcessingVariant;
  currentUserNpub?: string;
  targetUserNpub?: string;
}

// ── Custom Animated Beam ───────────────────────────────────────────────
function AnimatedBeam() {
  const theme = useTheme();
  const tx = useSharedValue(-60);

  useEffect(() => {
    tx.value = withRepeat(
      withTiming(60, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  return (
    <View
      width={60}
      height={4}
      borderColor="$borderColor"
      borderWidth={1}
      borderRadius="$2"
      overflow="hidden"
    >
      <Animated.View
        style={[
          {
            width: 20,
            height: 4,
            backgroundColor: theme.accent10?.val || '#FFD700',
            borderRadius: 2,
          },
          animatedStyle,
        ]}
      />
    </View>
  );
}

export function ProcessingSheet({
  visible,
  status = 'processing',
  title,
  amount,
  detail,
  errorMessage,
  onClose,
  onRetry,
  onViewDetails,
  mintUrl,
  type = 'standard',
  recipient,
  direction = 'send',
  variant = 'standard',
}: ProcessingSheetProps) {
  const sheetRef = useRef<AppBottomSheetRef>(null);
  const { secondaryCurrency } = useSettingsStore();

  useEffect(() => {
    if (visible) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }

    return () => {
      sheetRef.current?.dismiss();
    };
  }, [visible]);

  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
    enabled: visible && !!amount,
  });

  const fiatValue = React.useMemo(() => {
    if (!amount) return '';
    if (!btcData?.price) return '...';
    return currencyService.formatValue(
      currencyService.convertSatsToCurrency(amount, btcData.price),
      secondaryCurrency as CurrencyCode,
    );
  }, [amount, btcData?.price, secondaryCurrency]);

  const isProcessing = status === 'processing';
  const isSuccess = status === 'success';
  const isError = status === 'error';
  const isOfflineSaved =
    isError &&
    errorMessage &&
    (errorMessage.includes('Could not connect to mint') ||
      errorMessage.includes('saved to your transaction history') ||
      errorMessage.includes('saved in your history'));

  const mintDomain = mintUrl ? mintUrl.replace(/^https?:\/\//, '').split('/')[0] : 'Unknown';

  const truncate = (s?: string) => {
    if (!s) return 'Unknown';
    if (s.includes('@')) return s;
    if (s.length > 20) return `${s.slice(0, 10)}...${s.slice(-6)}`;
    return s;
  };

  const theme = useTheme();

  return (
    <Theme inverse>
      <AppBottomSheet ref={sheetRef} onClose={onClose} enablePanDownToClose={!isProcessing}>
        <YStack items="center" py="$2" px="$3" gap="$3">
          {/* ── Processing State UI ────────────────────────────────────── */}
          {isProcessing && (
            <YStack items="center" gap="$4" py="$6" width="100%">
              {variant === 'standard' && <ActivityIndicator size={56} color={theme.color1?.val} />}
              {variant === 'nostr' && (
                <XStack items="center" gap="$3">
                  <View
                    width={48}
                    height={48}
                    borderRadius={5}
                    bg="$purple10"
                    items="center"
                    justify="center"
                  >
                    <Image source={nostrIconWhite} width={40} height={40} resizeMode="contain" />
                  </View>
                  <AnimatedBeam />
                  <View
                    width={40}
                    height={40}
                    borderRadius={5}
                    bg="$gray3"
                    items="center"
                    justify="center"
                    borderWidth={1}
                    borderColor="$gray6"
                  >
                    <User size={24} color="$color" />
                  </View>
                </XStack>
              )}

              <Text fontSize="$6" fontWeight="700" color="$color1">
                {title || 'Processing...'}
              </Text>

              {detail && (
                <Text fontSize="$4" color="$gray10" fontWeight="500" textAlign="center" px="$4">
                  {detail}
                </Text>
              )}
            </YStack>
          )}

          {/* ── Success State UI ───────────────────────────────────────── */}
          {isSuccess && (
            <YStack width="100%" gap="$3">
              {/* Amount Display */}
              {amount !== undefined && amount > 0 && (
                <YStack gap="$2" py="$4" items="center" justify="center">
                  <Text fontSize={52} fontWeight="700" color="$accent3" lineHeight={54}>
                    {currencyService.formatSats(amount)}
                  </Text>
                  <Text color="$accent5" fontWeight="600" fontSize={16}>
                    {fiatValue}
                  </Text>
                </YStack>
              )}

              {/* Status Badge */}
              <XStack
                self="center"
                items="center"
                gap="$2"
                bg="$green9"
                px="$4"
                py="$3"
                rounded="$10"
                mb="$1"
              >
                <Check size={16} color="white" />
                <Text fontSize="$3" fontWeight="700" color="white">
                  {direction === 'send' ? 'Sent Successfully' : 'Received Successfully'}
                </Text>
              </XStack>

              {/* Description */}
              {detail && (
                <Text
                  color="$gray10"
                  fontSize="$4"
                  textAlign="center"
                  px="$4"
                  py="$1"
                  lineHeight={20}
                >
                  {detail}
                </Text>
              )}

              {/* Details Box */}
              {mintUrl && (
                <YStack bg="$gray2" rounded="$5" overflow="hidden" mb="$4">
                  <View p="$3" px="$4">
                    <Text fontSize="$3" fontWeight="700" color="$gray12">
                      Details
                    </Text>
                  </View>
                  <Separator borderColor="$borderColor" opacity={0.3} />
                  <YGroup separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
                    <DetailRow
                      icon={<User size={14} color="$gray10" />}
                      label={direction === 'send' ? 'To' : 'From'}
                      value={truncate(recipient)}
                    />
                    <DetailRow
                      icon={<Landmark size={14} color="$gray10" />}
                      label="Mint"
                      value={mintDomain}
                    />
                    <DetailRow
                      icon={<Clock size={14} color="$gray10" />}
                      label="Time"
                      value={new Date().toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    />
                    <DetailRow
                      icon={<Zap size={14} color="$gray10" />}
                      label="Type"
                      value={type === 'p2pk' ? 'P2PK' : 'Standard'}
                    />
                  </YGroup>
                </YStack>
              )}

              {/* Action Button */}
              <YStack width="100%" gap="$2" pt="$2">
                <AppButton variant="default" emphasis="primary" size="medium" onPress={onClose}>
                  DONE
                </AppButton>
                {onViewDetails && (
                  <AppButton
                    variant="default"
                    emphasis="secondary"
                    size="medium"
                    onPress={onViewDetails}
                  >
                    DETAILS
                  </AppButton>
                )}
              </YStack>
            </YStack>
          )}

          {/* ── Error / Offline State UI ───────────────────────────────── */}
          {isError && (
            <YStack width="100%" gap="$4" py="$2">
              <YStack justify="center" items="center" gap="$3" py="$4">
                <YStack
                  width={80}
                  height={80}
                  rounded="$10"
                  bg={isOfflineSaved ? '$orange4' : '$red4'}
                  items="center"
                  justify="center"
                >
                  {isOfflineSaved ? (
                    <Clock size={40} color="$orange10" strokeWidth={2.5} />
                  ) : (
                    <XCircle size={40} color="$red10" strokeWidth={2.5} />
                  )}
                </YStack>
                <YStack items="center" gap="$1" py="$2">
                  <Text fontSize="$6" fontWeight="900" color="$color">
                    {isOfflineSaved ? 'Received Offline' : 'Payment Failed'}
                  </Text>
                  <Text color="$gray10" fontSize="$4" textAlign="center" px="$4" lineHeight={20}>
                    {errorMessage || 'An error occurred during transaction processing.'}
                  </Text>
                </YStack>
              </YStack>

              {/* Actions */}
              <YStack width="100%" gap="$2">
                {isOfflineSaved ? (
                  <AppButton variant="default" emphasis="primary" size="medium" onPress={onClose}>
                    GOT IT
                  </AppButton>
                ) : (
                  <>
                    {onRetry && (
                      <AppButton
                        variant="branded"
                        emphasis="primary"
                        size="medium"
                        onPress={onRetry}
                      >
                        TRY AGAIN
                      </AppButton>
                    )}
                    <AppButton variant="default" emphasis="primary" size="medium" onPress={onClose}>
                      CLOSE
                    </AppButton>
                  </>
                )}
              </YStack>
            </YStack>
          )}
        </YStack>
      </AppBottomSheet>
    </Theme>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <XStack justify="space-between" items="center" py="$3" px="$4">
      <XStack gap="$2" items="center">
        {icon}
        <Text color="$gray10" fontSize="$3" fontWeight="600">
          {label}
        </Text>
      </XStack>
      <Text
        color="$color"
        fontSize="$3"
        fontWeight="800"
        numberOfLines={1}
        style={{ maxWidth: 180 }}
      >
        {value}
      </Text>
    </XStack>
  );
}
