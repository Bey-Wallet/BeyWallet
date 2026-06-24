import React from 'react';
import { Text } from 'tamagui';
import { ListTable, ListTableRow } from '~/components/UI/ListTable';
import { currencyService, CurrencyCode } from '~/services/currencyService';
import { formatFullLocalTime } from '~/utils/time';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useToastController } from '@tamagui/toast';

interface CompletedMintDetailsTableProps {
    entry: any;
    formattedStatus: string;
    primaryCurrency: string;
    secondaryCurrency: string;
    fiatAmount: number;
    title: string;
    savedInvoice: string | null;
}

export function CompletedMintDetailsTable({
    entry,
    formattedStatus,
    primaryCurrency,
    secondaryCurrency,
    fiatAmount,
    title,
    savedInvoice
}: CompletedMintDetailsTableProps) {
    const toast = useToastController();

    const handleCopyInvoice = async () => {
        if (savedInvoice) {
            await Clipboard.setStringAsync(savedInvoice);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            toast.show('Copied!', { message: 'Invoice copied to clipboard' });
        }
    };

    return (
        <ListTable mb="$4">
            {primaryCurrency === 'FIAT' ? (
                <>
                    <ListTableRow label="Amount" value={currencyService.formatValue(fiatAmount, secondaryCurrency as CurrencyCode)} />
                    <ListTableRow label="Sats" value={`${entry.amount || 0} sats`} />
                </>
            ) : (
                <>
                    <ListTableRow label="Amount" value={`${entry.amount || 0} sats`} />
                    <ListTableRow label="Fiat" value={currencyService.formatValue(fiatAmount, secondaryCurrency as CurrencyCode)} />
                </>
            )}
            <ListTableRow label="Date" value={formatFullLocalTime(entry.createdAt)} />
            <ListTableRow label="Type" value={title} />
            <ListTableRow label="Status" value={formattedStatus} />
            <ListTableRow label="Mint" value={(entry.mintUrl || 'Unknown').replace(/^https?:\/\//, '').split('/')[0]} />
            {savedInvoice ? (
                <ListTableRow
                    label="Invoice"
                    value={`${savedInvoice.substring(0, 10)}...${savedInvoice.substring(savedInvoice.length - 10)}`}
                    isCopyable
                    onCopy={handleCopyInvoice}
                />
            ) : null}
        </ListTable>
    );
}
