import React, { useEffect, useRef } from 'react';
import { YStack, XStack, Text, View, Button, Theme, useTheme } from 'tamagui';
import { CheckCircle2, XCircle, Clock, Building2, Zap, User, Smartphone, Wifi } from '@tamagui/lucide-icons';
import AppBottomSheet, { AppBottomSheetRef } from './AppBottomSheet';
import { Spinner } from './Spinner';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { Image } from 'tamagui';

const nostrIconWhite = require('../../assets/images/nostr-icon-white-transparent.png');

export type ProcessingVariant = 'standard' | 'nostr' | 'nfc';

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
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  return (
    <View width={60} height={4} borderColor="$borderColor" borderWidth={1} borderRadius="$2" overflow="hidden">
      <Animated.View
        style={[
          { width: 20, height: 4, backgroundColor: theme.accent10?.val || '#FFD700', borderRadius: 2 },
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
  currentUserNpub = 'npub1test123',
  targetUserNpub = 'npub1target456'
}: ProcessingSheetProps) {
  const sheetRef = useRef<AppBottomSheetRef>(null);

  useEffect(() => {
    if (visible) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  const isProcessing = status === 'processing';
  const isSuccess = status === 'success';
  const isError = status === 'error';

  const mintDomain = mintUrl
    ? mintUrl.replace(/^https?:\/\//, '').split('/')[0]
    : 'Unknown';

  const truncate = (s?: string) => {
    if (!s) return 'Unknown';
    if (s.includes('@')) return s;
    if (s.length > 20) return `${s.slice(0, 10)}...${s.slice(-6)}`;
    return s;
  };

  return (
    <Theme inverse>
      <AppBottomSheet ref={sheetRef} onClose={onClose} enablePanDownToClose={!isProcessing}>
        <YStack items="center" py="$2" px="$2" gap="$2">

          {amount !== undefined && amount > 0 && (
            <Text fontSize={32} fontWeight="800" color="$color1" letterSpacing={-1}>
              ₿{amount.toLocaleString()}
            </Text>
          )}


          {/* ── Status Icon & Title ────────────────────────────────────── */}
          <YStack items="center" gap="$4" py="$2">
            {isProcessing && variant === 'standard' && (
              <XStack>
                <Spinner size="large" color="$color1" />
              </XStack>
            )}

            {isProcessing && variant === 'nostr' && (
              <XStack items="center" gap="$3">
                <View w={48} h={48} borderRadius={5} bg="$purple10" items="center" justify="center">
                  <Image source={nostrIconWhite} width={40} height={40} resizeMode="contain" />
                </View>
                <AnimatedBeam />
                <View w={40} h={40} borderRadius={5} bg="$gray3" items="center" justify="center" bw={1} bc="$gray6">
                  <User size={36} color="$color" />
                </View>
              </XStack>
            )}

            {isProcessing && variant === 'nfc' && (
              <XStack items="center" gap="$4">
                <View w={48} h={48} borderRadius={24} bg="$gray3" items="center" justify="center">
                  <Smartphone size={24} color="$color1" />
                </View>
                <AnimatedBeam />
                <View w={48} h={48} borderRadius={24} bg="$accent3" items="center" justify="center">
                  <Wifi size={24} color="$accent9" />
                </View>
              </XStack>
            )}

            {isSuccess && (
              <CheckCircle2 size={48} color="$green10" strokeWidth={2.5} />
            )}

            {isError && (
              <XCircle size={48} color="$red10" strokeWidth={2.5} />
            )}

            <Text
              fontSize="$5"
              fontWeight="700"
              color={isError ? "$red10" : isSuccess ? "$green10" : "$color1"}
            >
              {isError ? "Payment Failed" : isSuccess ? "Success" : title}
            </Text>
          </YStack>

          {/* ── Amount & Main Detail ──────────────────────────────────── */}
          {(amount !== undefined && amount > 0 || detail) && (
            <YStack items="center" gap="$1" py="$0">

              {/* Show detail only during processing or if success and no full details available */}
              {(isProcessing || (isSuccess && !mintUrl)) && detail && (
                typeof detail === 'string' ? (
                  <Text fontSize="$4" color="$gray10" fontWeight="500" textAlign="center" px="$4">
                    {detail}
                  </Text>
                ) : (
                  <View>{detail}</View>
                )
              )}
            </YStack>
          )}

          {/* ── Details / Error Message ────────────────────────────────── */}
          <View width="100%" items="center" justify="center">
            {isError && errorMessage && (
              <YStack items="center" gap="$3" width="100%" bg="$red3" p="$4" rounded="$4">
                <Text fontSize="$3" color="$red11" textAlign="center" fontWeight="500">
                  {errorMessage}
                </Text>
              </YStack>
            )}

            {isSuccess && mintUrl && (
              <YStack width="100%" gap="$4" py="$2">
                <DetailRow icon={<User size={16} color="$gray9" />} label={direction === 'send' ? "To" : "From"} value={truncate(recipient)} />
                <DetailRow icon={<Building2 size={16} color="$gray9" />} label="Mint" value={mintDomain} />
                <DetailRow icon={<Clock size={16} color="$gray9" />} label="Time" value={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
                <DetailRow icon={<Zap size={16} color="$gray9" />} label="Type" value={type === 'p2pk' ? "P2PK" : "Standard"} />
              </YStack>
            )}
          </View>

          {/* ── Actions ────────────────────────────────────────────────── */}
          <XStack width="100%" gap="$3" pt="$4">
            {isSuccess && (
              <>
                <Button flex={1} bg="$gray4" color="$color" size="$5" fontWeight="700" onPress={onClose} rounded="$6" pressStyle={{ scale: 0.97 }}>
                  Done
                </Button>
                {onViewDetails && (
                  <Button flex={1} theme="accent" size="$5" fontWeight="700" onPress={onViewDetails} rounded="$6" pressStyle={{ scale: 0.97 }}>
                    Details
                  </Button>
                )}
              </>
            )}

            {isError && (
              <>
                <Button flex={1} bg="$gray4" color="$color" size="$5" fontWeight="700" onPress={onClose} rounded="$6" pressStyle={{ scale: 0.97 }}>
                  Dismiss
                </Button>
                {onRetry && (
                  <Button flex={1} bg="$red9" color="white" size="$5" fontWeight="700" onPress={onRetry} rounded="$6" pressStyle={{ scale: 0.97 }}>
                    Try Again
                  </Button>
                )}
              </>
            )}
          </XStack>

        </YStack>
      </AppBottomSheet>
    </Theme>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <XStack justify="space-between" items="center" px="$2">
      <XStack gap="$3" items="center">
        {icon}
        <Text color="$gray10" fontSize="$4" fontWeight="500">{label}</Text>
      </XStack>
      <Text color="$color" fontSize="$4" fontWeight="700" numberOfLines={1} style={{ maxWidth: 180 }}>
        {value}
      </Text>
    </XStack>
  );
}
