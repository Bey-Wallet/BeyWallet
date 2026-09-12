import React, { useState, useEffect, useMemo } from 'react';
import {
  YStack,
  XStack,
  Text,
  Button,
  View,
  Paragraph,
  Separator,
  ScrollView,
  Spinner,
} from 'tamagui';
import { Copy, Check, Clock, ShieldCheck, Sprout, Building2, Zap } from '@tamagui/lucide-icons';
import QRCode from 'react-native-qrcode-svg';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useToastController } from '@tamagui/toast';
import { useQuery } from '@tanstack/react-query';
import { mintManager } from '~/services/core';

interface PaymentStageProps {
  amount: string;
  invoice: string;
  quoteId: string;
  mintUrl: string;
  expiry?: number;
  onPaid: () => Promise<void> | void;
  onCancel: () => void;
}

export function PaymentStage({
  amount,
  invoice,
  quoteId,
  mintUrl,
  expiry,
  onPaid,
  onCancel,
}: PaymentStageProps) {
  const sats = parseInt(amount, 10);
  const toast = useToastController();
  const [copied, setCopied] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const getMintName = (url: string) => {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace('testnut.', '').replace('.cashu.space', '');
    } catch {
      return url;
    }
  };

  // Calculate time remaining until expiry
  useEffect(() => {
    if (!expiry) return;

    const calculateTimeLeft = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = expiry - now;
      return remaining > 0 ? remaining : 0;
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiry]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(invoice);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    toast.show('Copied!', { message: 'Invoice copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  const isExpired = timeLeft !== null && timeLeft <= 0;

  const { data: feePpk = 0 } = useQuery({
    queryKey: ['mintFeePpk', mintUrl],
    queryFn: () => mintManager.getFeePpk(mintUrl),
    staleTime: 5 * 60 * 1000,
    enabled: !!mintUrl,
  });

  const feeDisplay = useMemo(() => {
    if (!feePpk || feePpk <= 0) return '0 SATS (Free)';
    const estimatedFee = Math.ceil((sats * feePpk) / 1000);
    return estimatedFee > 0 ? `~${estimatedFee} SATS` : '0 SATS (Free)';
  }, [feePpk, sats]);

  return (
    <YStack flex={1} bg="$background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 } as any}
        px="$0"
      >
        <YStack items="center" gap="$4" mb="$4">
          <View bg="white" p="$2" borderColor="$borderColor" borderWidth={1} rounded="$5">
            <QRCode
              value={invoice}
              size={330}
              backgroundColor="white"
              color="black"
              quietZone={10}
            />
          </View>
        </YStack>

        <YStack
          gap="$0"
          mb="$6"
          bg="$gray2"
          rounded="$5"
          overflow="hidden"
          separator={<Separator borderColor="$borderColor" opacity={0.5} />}
        >
          <DetailItem label="Pay Invoice" value={`${sats} SATS`} />
          <DetailItem label="Expires in (UTC)" value={`${formatTime(timeLeft)}`} />
          <DetailItem label="Mint" value={getMintName(mintUrl)} />
          <DetailItem label="Fee Rate" value={feeDisplay} />
          <DetailItem
            label="Invoice"
            value={`${invoice.substring(0, 10)}...${invoice.substring(invoice.length - 10)}`}
            isCopyable
            onCopy={handleCopy}
          />
        </YStack>
      </ScrollView>

      <YStack position="absolute" b={0} l={0} r={0} py="$2" bg="$background">
        <XStack width="100%" justify="space-evenly" gap="$3">
          <Button
            theme="red"
            size="$5"
            height={55}
            rounded="$4"
            fontWeight="800"
            bg="$red3"
            color="$red10"
            flex={1}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onCancel();
            }}
          >
            Cancel
          </Button>
          <Button
            theme="accent"
            size="$5"
            flex={1}
            height={55}
            rounded="$4"
            fontWeight="800"
            disabled={isExpired || isChecking}
            icon={isChecking ? <Spinner size="small" color="white" /> : undefined}
            onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setIsChecking(true);
              try {
                await onPaid();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (err: any) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                toast.show('Not Paid Yet', {
                  message: 'The invoice has not been paid yet. Please wait or try again.',
                });
              } finally {
                setIsChecking(false);
              }
            }}
          >
            {isChecking ? '...' : 'I Paid'}
          </Button>
        </XStack>
      </YStack>
    </YStack>
  );
}

function DetailItem({
  label,
  value,
  isCopyable,
  onCopy,
}: {
  label: string;
  value: string;
  isCopyable?: boolean;
  onCopy?: () => void;
}) {
  return (
    <XStack justify="space-between" items="center" py="$3" px="$4">
      <Text fontSize="$4" color="$gray10" fontWeight="600">
        {label}
      </Text>
      <XStack gap="$2" items="center">
        <Text
          fontSize="$5"
          fontWeight="800"
          color="$color"
          numberOfLines={1}
          style={{ maxWidth: 200 }}
        >
          {value}
        </Text>
        {isCopyable && (
          <Button size="$2" chromeless icon={<Copy size={16} color="$gray10" />} onPress={onCopy} />
        )}
      </XStack>
    </XStack>
  );
}
