import React, { useState, useRef, useMemo } from 'react';
import { Text, XStack, YStack, Button, Separator } from 'tamagui';
import { ChevronDown, Trash2, AlertTriangle } from '@tamagui/lucide-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { initService, historyService } from '../services/core';
import { AppDropdownMenu } from './UI/AppDropdownMenu';
import AppBottomSheet, { AppBottomSheetRef } from './UI/AppBottomSheet';
import * as Haptics from 'expo-haptics';
import { useToastController } from '@tamagui/toast';

export default function HistoryVolume() {
    const queryClient = useQueryClient();
    const toast = useToastController();
    const confirmSheetRef = useRef<AppBottomSheetRef>(null);

    const [actionType, setActionType] = useState<'spent_proofs' | 'dead_invoices' | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const { data: volHistory = [] } = useQuery({
        queryKey: ['history-volume'],
        queryFn: async () => {
            if (!initService.isInitialized()) return [];
            return historyService.getHistory(1000, 0);
        },
        enabled: initService.isInitialized(),
        refetchInterval: 5000,
    });

    const count = volHistory.length;

    const handleOpenConfirm = (type: 'spent_proofs' | 'dead_invoices') => {
        setActionType(type);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        confirmSheetRef.current?.present();
    };

    const handleExecuteAction = async () => {
        if (!actionType || isProcessing) return;
        setIsProcessing(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        try {
            const repo = initService.getRepo();
            if (actionType === 'spent_proofs') {
                // Delete spent proofs from DB
                const res = await repo.db.run(`DELETE FROM coco_cashu_proofs WHERE state = 'spent'`);
                const deletedCount = res.changes || 0;
                toast.show('Cleaned spent proofs', { message: `Successfully deleted ${deletedCount} spent proofs.` });
            } else if (actionType === 'dead_invoices') {
                // Delete dead (expired unpaid) quotes
                const nowSeconds = Math.floor(Date.now() / 1000);
                const mintRes = await repo.db.run(`DELETE FROM coco_cashu_mint_quotes WHERE state = 'UNPAID' AND expiry < ?`, [nowSeconds]);
                const meltRes = await repo.db.run(`DELETE FROM coco_cashu_melt_quotes WHERE state = 'UNPAID' AND expiry < ?`, [nowSeconds]);
                const totalDeleted = (mintRes.changes || 0) + (meltRes.changes || 0);
                toast.show('Cleaned dead invoices', { message: `Successfully deleted ${totalDeleted} expired quotes.` });
            }

            // Invalidate queries so caches refresh
            queryClient.invalidateQueries({ queryKey: ['history'] });
            queryClient.invalidateQueries({ queryKey: ['history-volume'] });
            queryClient.invalidateQueries({ queryKey: ['proofs'] });
            
            confirmSheetRef.current?.dismiss();
        } catch (e: any) {
            console.error('[HistoryVolume] Cleanup action failed:', e);
            toast.show('Cleanup failed', { message: e.message || 'An error occurred during database cleanup.' });
        } finally {
            setIsProcessing(false);
            setActionType(null);
        }
    };

    const menuItems = useMemo(() => [
        {
            key: 'spent_proofs',
            title: 'Delete spent proofs',
            icon: <Trash2 size={16} color="$red10" />,
            destructive: true,
            action: () => handleOpenConfirm('spent_proofs')
        },
        {
            key: 'dead_invoices',
            title: 'Delete dead invoices',
            icon: <Trash2 size={16} color="$red10" />,
            destructive: true,
            action: () => handleOpenConfirm('dead_invoices')
        }
    ], []);

    const trigger = (
        <XStack
            items="center"
            gap="$1.5"
            justify="flex-end"
            pressStyle={{ opacity: 0.8 }}
        >
            <ChevronDown size={20} color="$color5" />
            <Text fontSize="$6" fontWeight="800" color="$color10">
                {count}
            </Text>
            {/* <Text fontSize="$3" fontWeight="800" color="$color5">
                txs
            </Text> */}
        </XStack>
    );

    if (count === 0) return null;

    return (
        <>
            <AppDropdownMenu trigger={trigger} items={menuItems} placement="bottom-end" width={220} />

            <AppBottomSheet ref={confirmSheetRef} snapPoints={['38%']}>
                <YStack p="$4" gap="$4">
                    <XStack gap="$2" items="center" alignSelf="center">
                        <AlertTriangle size={24} color="$red10" />
                        <Text fontSize="$6" fontWeight="800" color="$red10">Confirm Delete</Text>
                    </XStack>
                    
                    <Text fontSize="$4" color="$gray11" text="center" px="$3">
                        {actionType === 'spent_proofs' 
                            ? 'Are you sure you want to delete spent proofs from database? This is safe and removes redundant local storage records.'
                            : 'Are you sure you want to delete all expired and unpaid lightning and on-chain quotes?'}
                    </Text>

                    <YStack gap="$2.5" pt="$3">
                        <Button 
                            bg="$red10" 
                            color="white" 
                            size="$4" 
                            height={50}
                            fontWeight="800" 
                            onPress={handleExecuteAction}
                            disabled={isProcessing}
                        >
                            {isProcessing ? 'Processing...' : 'Confirm'}
                        </Button>
                        <Button 
                            bg="$gray3" 
                            color="$color" 
                            size="$4" 
                            height={50}
                            fontWeight="800" 
                            onPress={() => confirmSheetRef.current?.dismiss()}
                            disabled={isProcessing}
                        >
                            Cancel
                        </Button>
                    </YStack>
                </YStack>
            </AppBottomSheet>
        </>
    );
}
