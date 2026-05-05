import React, { useEffect, useRef } from 'react';
import { YStack, XStack, Text, View, Button, Separator } from 'tamagui';
import { Check, X, Info, Clock, Building2, Zap, User } from '@tamagui/lucide-icons';
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
      <YStack items="center" py="$6" px="$4" gap="$5">

        {/* ── Header State ───────────────────────────────────────────── */}
        <YStack items="center" gap="$2">
          {isSuccess && (
            <View bg="$green4" p="$3" rounded="$12" mb="$2">
              <Check size={32} color="$green10" strokeWidth={3} />
            </View>
          )}
          {isError && (
            <View bg="$red4" p="$3" rounded="$12" mb="$2">
              <X size={32} color="$red10" strokeWidth={3} />
            </View>
          )}

          <Text fontSize="$3" fontWeight="900" color={isError ? "$red10" : isSuccess ? "$green10" : "$accent10"} textTransform="uppercase" letterSpacing={2}>
            {isError ? "Payment Failed" : isSuccess ? "Success" : title}
          </Text>

          <YStack items="center">
            {amount !== undefined && amount > 0 && (
              <Text fontSize="$8" fontWeight="900" color="$color">
                ₿{amount.toLocaleString()}
              </Text>
            )}

            {/* Show detail only during processing or if success and no full details available */}
            {(isProcessing || (isSuccess && !mintUrl)) && detail && (
              typeof detail === 'string' ? (
                <Text fontSize="$4" color="$color12" fontWeight="800" textAlign="center" px="$4">
                  {detail}
                </Text>
              ) : (
                detail
              )
            )}
          </YStack>
        </YStack>

        {/* ── Main Content ───────────────────────────────────────────── */}
        <View width="100%" items="center" justify="center">
          {isProcessing && (
            <YStack items="center" gap="$4">
              <View p="$2" bg="$background" borderColor="$borderColor" borderWidth={1} rounded="$12">
                <Spinner size="xlarge" color="$color" />
              </View>
              <Text fontSize="$2" color="$gray9" fontWeight="600" letterSpacing={1}>
                Transaction in progress
              </Text>
            </YStack>
          )}

          {isError && (
            <YStack items="center" gap="$3" width="100%">
              <Text fontSize="$3" color="$red10" textAlign="center" fontWeight="500">
                {errorMessage || "An unexpected error occurred"}
              </Text>
            </YStack>
          )}

          {isSuccess && mintUrl && (
            <YStack width="100%" gap="$3" bg="$color2" p="$4" rounded="$4" borderWidth={1} borderColor="$borderColor">
              <DetailRow icon={<User size={14} color="$gray10" />} label={direction === 'send' ? "To" : "From"} value={truncate(recipient)} />
              <DetailRow icon={<Building2 size={14} color="$gray10" />} label="Mint" value={mintDomain} />
              <DetailRow icon={<Clock size={14} color="$gray10" />} label="Time" value={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
              <DetailRow icon={<Zap size={14} color="$gray10" />} label="Type" value={type === 'p2pk' ? "P2PK" : "Standard"} />
            </YStack>
          )}
        </View>

        {/* ── Actions ────────────────────────────────────────────────── */}
        <XStack width="100%" gap="$3" pt="$2">
          {isSuccess && (
            <>
              <Button flex={1} theme="gray" size="$4" fontWeight="800" onPress={onClose} rounded="$4">
                Dismiss
              </Button>
              {onViewDetails && (
                <Button flex={1} theme="accent" size="$4" fontWeight="800" onPress={onViewDetails} rounded="$4">
                  View Details
                </Button>
              )}
            </>
          )}

          {isError && (
            <>
              <Button flex={1} theme="gray" size="$4" fontWeight="800" onPress={onClose} rounded="$4">
                Dismiss
              </Button>
              {onRetry && (
                <Button flex={1} theme="red" size="$4" fontWeight="800" onPress={onRetry} rounded="$4">
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
    <XStack justify="space-between" items="center">
      <XStack gap="$2" items="center">
        {icon}
        <Text color="$gray10" fontSize="$3" fontWeight="600">{label}</Text>
      </XStack>
      <Text color="$color" fontSize="$3" fontWeight="800" numberOfLines={1} style={{ maxWidth: 180 }}>
        {value}
      </Text>
    </XStack>
  );
}
