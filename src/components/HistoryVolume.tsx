import React from 'react';
import { Text, XStack } from 'tamagui';
import { useQuery } from '@tanstack/react-query';
import { initService, historyService } from '../services/core';

export default function HistoryVolume() {
    const { data: volHistory = [] } = useQuery({
        queryKey: ['history-volume'],
        queryFn: async () => {
            if (!initService.isInitialized()) return [];
            // Fetch sample for counting
            return historyService.getHistory(1000, 0);
        },
        enabled: initService.isInitialized(),
        refetchInterval: 5000, // Refresh occasionally
    });

    const count = volHistory.length;

    if (count === 0) return null;

    return (
        <XStack
            items="center"
            gap="$1"
            justify="flex-end"
            pressStyle={{ opacity: 0.8 }}
        >
            <Text fontSize="$6" fontWeight="800" color="$color10">
                {count}
            </Text>
            <Text fontSize="$3" fontWeight="800" color="$color5">
                txs
            </Text>
        </XStack>
    );
}
