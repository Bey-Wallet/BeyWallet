import React, { useEffect, useRef } from 'react';
import { YStack, XStack, Text, View, Button } from 'tamagui';
import { CheckCircle2, XCircle, Clock, Building2, Zap, User } from '@tamagui/lucide-icons';
import AppBottomSheet, { AppBottomSheetRef } from './AppBottomSheet';
import { Spinner } from './Spinner';

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
  direction = 'send'
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
    <AppBottomSheet ref={sheetRef} onClose={onClose} enablePanDownToClose={!isProcessing}>
      <YStack items="center" py="$6" px="$5" gap="$5">

        {/* ── Status Icon & Title ────────────────────────────────────── */}
        <YStack items="center" gap="$3">
          {isProcessing && (
            <View py="$2">
              <Spinner size="large" color="$accent10" />
            </View>
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
            color={isError ? "$red10" : isSuccess ? "$green10" : "$color"}
          >
            {isError ? "Payment Failed" : isSuccess ? "Success" : title}
          </Text>
        </YStack>

        {/* ── Amount & Main Detail ──────────────────────────────────── */}
        {(amount !== undefined && amount > 0 || detail) && (
          <YStack items="center" gap="$1" py="$2">
            {amount !== undefined && amount > 0 && (
              <Text fontSize={42} fontWeight="800" color="$color" letterSpacing={-1}>
                ₿{amount.toLocaleString()}
              </Text>
            )}

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
