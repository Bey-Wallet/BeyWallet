import React, { useEffect } from 'react';
import { YStack, XStack, Text, Button, H2, Separator, Circle } from "tamagui";
import { CheckCircle, XCircle, AlertCircle } from "@tamagui/lucide-icons";
import * as Haptics from 'expo-haptics';
import { ListTable, ListTableRow } from '~/components/UI/ListTable';
import { currencyService, CurrencyCode } from '~/services/currencyService';
import { useSettingsStore } from '~/store/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/bitcoinService';

interface ResultStageProps {
    status: 'success' | 'error' | 'cancelled';
    amount: string;
    mintUrl?: string;
    error?: string | null;
    onClose: () => void;
}

export function ResultStage({ status, amount, mintUrl, error, onClose }: ResultStageProps) {
    const isSuccess = status === 'success';
    const sats = parseInt(amount, 10);

    const { secondaryCurrency } = useSettingsStore();

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    });

    const fiatValue = btcData?.price
        ? currencyService.formatValue(
            currencyService.convertSatsToCurrency(Number(amount), btcData.price),
            secondaryCurrency as CurrencyCode
        )
        : '...';

    useEffect(() => {
        if (isSuccess) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (status === 'error') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
    }, [status]);

    const getIcon = () => {
        switch (status) {
            case 'success':
                return <CheckCircle size={40} color="white" />;
            case 'error':
                return <XCircle size={40} color="white" />;
            case 'cancelled':
                return <AlertCircle size={40} color="white" />;
        }
    };

    const getTitle = () => {
        switch (status) {
            case 'success':
                return 'Deposit Successful';
            case 'error':
                return 'Deposit Failed';
            case 'cancelled':
                return 'Deposit Cancelled';
        }
    };

    const getMessage = () => {
        switch (status) {
            case 'success':
                return `Successfully minted ${sats} SATS to your wallet.`;
            case 'error':
                return error || 'An error occurred while processing your deposit.';
            case 'cancelled':
                return 'The transaction was cancelled.';
        }
    };

    const getStatusColor = () => {
        switch (status) {
            case 'success':
                return '$green10';
            case 'error':
                return '$red10';
            case 'cancelled':
                return '$orange10';
        }
    };

    return (
        <YStack flex={1} bg="$background">
            <YStack flex={1}>
                {/* 1. Status and Amount Display */}
                <YStack width="100%" justify="space-between" height={260} bg="$gray2" rounded="$5" items="center" gap="$4" mb="$6">
                    <Text width="100%" p="$3" text="center" borderBottomWidth={1} borderColor="$borderColor" fontWeight="800" fontSize="$5" color={status === 'error' ? "$red10" : status === 'cancelled' ? "$orange10" : "$color"}>
                        {status === 'success' ? 'Deposit Successful' : status === 'error' ? 'Deposit Failed' : 'Deposit Cancelled'}
                    </Text>
                    <YStack items="center" justify="center">
                        <Text fontSize="$9" fontWeight="900" color={status === 'success' ? "$green11" : status === 'error' ? "$red11" : "$orange11"}>
                            +₿{Number(amount || 0).toLocaleString()}
                        </Text>
                        <Text fontSize="$5" fontWeight="600" color="$gray10">
                            Ecash SATS
                        </Text>
                    </YStack>
                    <YStack items="center" width="100%" gap="$1" p="$3" borderTopWidth={1} borderColor="$borderColor">
                        <Text color="$gray10" fontSize="$4" text="center">
                            {status === 'success' ? `Successfully minted to your wallet.` : status === 'error' ? (error || 'An error occurred while processing.') : 'The transaction was cancelled.'}
                        </Text>
                    </YStack>
                </YStack>

                {/* Details Table */}
                <ListTable>
                    <ListTableRow label="Total Amount" value={`₿${sats} sats`} />
                    <ListTableRow label="Status" value={status === 'success' ? 'Deposited' : status === 'error' ? 'Failed' : 'Cancelled'} valueColor={getStatusColor()} />
                    {status === 'success' && (
                        <>
                            <ListTableRow label="Date" value={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
                            {mintUrl && <ListTableRow label="Mint" value={mintUrl.replace(/^https?:\/\//, '').split('/')[0]} />}
                            <ListTableRow label="Fiat Value" value={fiatValue} />
                        </>
                    )}
                </ListTable>
            </YStack>

            <YStack position="absolute" b={0} l={0} r={0} bg="$background" borderTopWidth={1} borderColor="$gray3">
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
