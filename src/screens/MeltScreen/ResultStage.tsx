import React from 'react';
import { YStack, XStack, Text, Button, View, H2, Circle, Separator } from 'tamagui';
import { CheckCircle, XCircle, Zap, ArrowLeft, Copy, ExternalLink } from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { ListTable, ListTableRow } from '~/components/UI/ListTable';
import { currencyService, CurrencyCode } from '~/services/currencyService';
import { useSettingsStore } from '~/store/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/bitcoinService';

interface MeltResultStageProps {
    status: 'success' | 'error';
    amount: number;
    feeReserve: number;
    error?: string | null;
    onClose: () => void;
}

export function MeltResultStage({ status, amount, feeReserve, error, onClose }: MeltResultStageProps) {
    const { secondaryCurrency } = useSettingsStore();

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    });

    const fiatValue = btcData?.price
        ? currencyService.formatValue(
            currencyService.convertSatsToCurrency(amount, btcData.price),
            secondaryCurrency as CurrencyCode
        )
        : '...';

    React.useEffect(() => {
        if (status === 'success') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    }, [status]);

    const getIcon = () => {
        switch (status) {
            case 'success':
                return <CheckCircle size={40} color="white" />;
            case 'error':
                return <XCircle size={40} color="white" />;
        }
    };

    const getTitle = () => {
        switch (status) {
            case 'success':
                return 'Payment Sent';
            case 'error':
                return 'Payment Failed';
        }
    };

    const getMessage = () => {
        switch (status) {
            case 'success':
                return 'Successfully paid Lightning invoice.';
            case 'error':
                return error || 'The Lightning payment could not be completed.';
        }
    };

    const getStatusColor = () => {
        switch (status) {
            case 'success':
                return '$green10';
            case 'error':
                return '$red10';
        }
    };

    return (
        <YStack flex={1} bg="$background">
            <YStack flex={1}>
                {/* 1. Status and Amount Display */}
                <YStack width="100%" justify="space-between" height={260} bg="$gray2" rounded="$5" items="center" gap="$4" mb="$6">
                    <Text width="100%" p="$3" text="center" borderBottomWidth={1} borderColor="$borderColor" fontWeight="800" fontSize="$5" color={status === 'error' ? "$red10" : "$color"}>
                        {status === 'success' ? 'Payment Sent' : 'Payment Failed'}
                    </Text>
                    <YStack items="center" justify="center">
                        <Text fontSize="$9" fontWeight="900" color={status === 'success' ? "$color" : "$red11"}>
                            -₿{Number(amount || 0).toLocaleString()}
                        </Text>
                        <Text fontSize="$5" fontWeight="600" color="$gray10">
                            Ecash SATS
                        </Text>
                    </YStack>
                    <YStack items="center" width="100%" gap="$1" p="$3" borderTopWidth={1} borderColor="$borderColor">
                        <Text color="$gray10" fontSize="$4" text="center">
                            {status === 'success' ? 'Successfully paid Lightning invoice.' : (error || 'The Lightning payment could not be completed.')}
                        </Text>
                    </YStack>
                </YStack>

                {/* Details Table */}
                {status === 'success' && (
                    <ListTable>
                        <ListTableRow label="Total Amount" value={`₿${amount} sats`} />
                        <ListTableRow label="Fee Reserve" value={`~${feeReserve} sats`} valueColor="$orange10" />
                        <ListTableRow label="Status" value="PAID" valueColor="$green10" />
                        <ListTableRow label="Date" value={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
                        <ListTableRow label="Fiat Value" value={fiatValue} />
                    </ListTable>
                )}
            </YStack>

            <YStack position="absolute" b={0} l={0} r={0} py="$2" bg="$background" borderTopWidth={0} borderColor="$gray3">
                <Button
                    bg={status === 'success' ? "$green10" : "$gray3"}
                    size="$5"
                    height={55}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onClose();
                    }}
                    fontWeight="800"
                    color={status === 'success' ? "white" : "$color"}
                    rounded="$4"
                >
                    DONE
                </Button>
            </YStack>
        </YStack>
    );
}
