import React, { useMemo } from 'react'
import { ChevronRight, Loader, RefreshCcw } from "@tamagui/lucide-icons"
import { useToastController } from '@tamagui/toast'
import { H2, Image, Text, View, XStack, YStack, Spinner, Stack } from "tamagui"
import { useQuery } from '@tanstack/react-query'
import { bitcoinService } from '../../../services/bitcoinService'
import * as Haptics from 'expo-haptics'
import { RollingNumber } from '~/components/UI/RollingNumber'
import { useSettingsStore } from '~/store/settingsStore'
import { currencyService, CurrencyCode } from '~/services/currencyService'

export default function BitcoinPriceCard() {
    const { secondaryCurrency } = useSettingsStore()
    const toast = useToastController()

    const { data, isLoading, isFetching, refetch, dataUpdatedAt, isError, error } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        refetchInterval: 300000,
        staleTime: 30000,
    })

    const handleRefresh = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        refetch()
    }

    const formatCurrency = (val: number) => {
        return currencyService.formatValue(val, secondaryCurrency as CurrencyCode)
    }

    const [now, setNow] = React.useState(Date.now());

    React.useEffect(() => {
        const interval = setInterval(() => {
            setNow(Date.now());
        }, 60000); // Update every 60 seconds — sub-minute precision not needed
        return () => clearInterval(interval);
    }, []);

    React.useEffect(() => {
        if (isError && error) {
            toast.show('Error', { message: error.message })
        }
    }, [isError, error])

    const timeAgo = useMemo(() => {
        if (!dataUpdatedAt) return ""
        const mins = Math.floor((now - dataUpdatedAt) / 60000)
        if (mins < 1) return "Just now"
        return `${mins} min ago`
    }, [dataUpdatedAt, now, isLoading])

    const isPositive = data ? data.change24h >= 0 : true

    return (
        <YStack
            width="100%"
            height={120}
            justify="space-between"
            borderColor="$gray3"
            borderWidth={0.5}
            rounded="$5"
            bg="$gray2"
            p="$2"
            pressStyle={{ opacity: 0.9, scale: 0.99 }}
            onPress={handleRefresh}
        >
            <XStack justify="space-between" items="center">
                <XStack gap="$2" items="center">

                    <Image
                        source={require("../../../assets/images/Bitcoin.png")}
                        width={25}
                        height={25}
                        rounded={5}
                    />

                    <Text fontWeight="700" fontSize="$4" color="$orange11">Bitcoin price</Text>
                </XStack>
                <XStack gap="$1.5" items="center">
                    <Text fontSize="$2" color="$gray10">{timeAgo}</Text>
                    {isFetching ? (
                        <Spinner size="small" color="$orange11" />
                    ) : (
                        <RefreshCcw size={18} color="$gray10" />
                    )}
                </XStack>
            </XStack>

            <XStack justify="space-between" items="flex-end" flex={1} pt="$3">
                <YStack gap="$1.5" flex={1} justify="flex-end">
                    {data ? (
                        <XStack justify="space-between">
                            <RollingNumber
                                showDecimals={false}

                                fontSize={24} fontWeight={800} letterSpacing={-1.5} color="$accent4" lineHeight={36}>
                                {formatCurrency(data.price)}
                            </RollingNumber>

                            <XStack gap="$2" items="flex-end" justify="flex-end">
                                <View
                                    bg={isPositive ? "$green3" : "$red3"}
                                    px="$2"
                                    py="$0.5"
                                    rounded="$2"
                                >
                                    <Text
                                        color={isPositive ? "$green10" : "$red10"}
                                        fontWeight="700"
                                        fontSize="$2"
                                    >
                                        {isPositive ? '+' : ''}{data.change24h.toFixed(2)}%
                                    </Text>
                                </View>
                                <Text color="$gray9" fontSize="$2" fontWeight="600">24h</Text>
                            </XStack>
                        </XStack>
                    ) : (
                        <YStack gap="$2">
                            <View height={30} width={120} bg="$gray5" rounded="$2" opacity={0.5} />
                            <View height={20} width={60} bg="$gray5" rounded="$2" opacity={0.5} />
                        </YStack>
                    )}
                </YStack>
            </XStack>
        </YStack>
    )
}