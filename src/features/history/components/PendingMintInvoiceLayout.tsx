import { AppButton } from '~/shared/ui/AppButton';
import React, { useState } from 'react';
import { YStack, XStack, Text, ScrollView, Separator, View } from 'tamagui';
import QRCode from 'react-native-qrcode-svg';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useToastController } from '@tamagui/toast';
import { currencyService, CurrencyCode } from '~/services/wallet/currencyService';
import { formatFullLocalTime } from '~/shared/utils/time';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';

interface PendingMintInvoiceLayoutProps {
  savedInvoice: string;
  timeLeft: number | null;
  entry: {
    id: string;
    amount: number;
    unit: string;
    mintUrl: string;
    createdAt: number;
    state?: string;
  };
  formattedStatus: string;
  primaryCurrency: string;
  secondaryCurrency: string;
  fiatAmount: number;
  isCheckingPaid: boolean;
  onCancel: () => Promise<void> | void;
  onPaid: () => Promise<void> | void;
}

export function PendingMintInvoiceLayout({
  savedInvoice,
  timeLeft,
  entry,
  formattedStatus,
  primaryCurrency,
  secondaryCurrency,
  fiatAmount,
  isCheckingPaid,
  onCancel,
  onPaid,
}: PendingMintInvoiceLayoutProps) {
  const toast = useToastController();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(savedInvoice);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    toast.show('Invoice copied to clipboard', { kind: 'success' });
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return 'Checking...';
    if (seconds <= 0) return 'Expired';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <YStack flex={1} bg="$background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 } as any}
        px="$4"
        pt="$4"
      >
        <YStack items="center" gap="$4" mb="$4">
          <View bg="white" p="$2" borderColor="$borderColor" borderWidth={1} rounded="$5">
            <QRCode
              value={savedInvoice}
              size={330}
              backgroundColor="white"
              color="black"
              quietZone={10}
            />
          </View>
        </YStack>

        {/* Details Table */}
        <ListTable mb="$6">
          {primaryCurrency === 'FIAT' ? (
            <>
              <ListTableRow
                label="Amount"
                value={currencyService.formatValue(fiatAmount, secondaryCurrency as CurrencyCode)}
              />
              <ListTableRow label="Sats" value={currencyService.formatSats(entry.amount || 0)} />
            </>
          ) : (
            <>
              <ListTableRow label="Amount" value={currencyService.formatSats(entry.amount || 0)} />
              <ListTableRow
                label="Fiat"
                value={currencyService.formatValue(fiatAmount, secondaryCurrency as CurrencyCode)}
              />
            </>
          )}
          <ListTableRow label="Date" value={formatFullLocalTime(entry.createdAt)} />
          <ListTableRow label="Type" value="Mint Ecash" />
          <ListTableRow label="Status" value={formattedStatus} />
          <ListTableRow
            label="Expires in (UTC)"
            value={
              <Text
                fontSize="$4"
                fontWeight="600"
                color={timeLeft !== null && timeLeft <= 60 ? '$red10' : '$orange10'}
              >
                {formatTime(timeLeft)}
              </Text>
            }
          />
          <ListTableRow
            label="Mint"
            value={(entry.mintUrl || 'Unknown').replace(/^https?:\/\//, '').split('/')[0]}
          />
          <ListTableRow
            label="Invoice"
            value={`${savedInvoice.substring(0, 10)}...${savedInvoice.substring(savedInvoice.length - 10)}`}
            isCopyable
            onCopy={handleCopy}
          />
        </ListTable>
      </ScrollView>

      <YStack position="absolute" b={0} l={0} r={0} py="$2" pb="$4" bg="$background" px="$4">
        <XStack width="100%" justify="space-evenly" gap="$3">
          <AppButton
            variant="critical"
            emphasis="secondary"
            size="large"
            flex={1}
            onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await onCancel();
            }}
          >
            Cancel
          </AppButton>
          <AppButton
            variant="branded"
            emphasis="primary"
            size="large"
            loading={isCheckingPaid}
            flex={1}
            disabled={isCheckingPaid || (timeLeft !== null && timeLeft <= 0)}
            onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await onPaid();
            }}
          >
            {isCheckingPaid ? '...' : 'I Paid'}
          </AppButton>
        </XStack>
      </YStack>
    </YStack>
  );
}
