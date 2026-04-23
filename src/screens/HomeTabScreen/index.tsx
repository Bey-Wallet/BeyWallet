import { RefreshControl } from 'react-native'
import { Anchor, H2, Paragraph, XStack, YStack, ScrollView, Button } from 'tamagui'
import * as Haptics from 'expo-haptics'
import { useToastController } from '@tamagui/toast'
import { ThemeSelector } from './components/ThemeSelector'
import { LocalizationTest } from './components/LocalizationTest'
import { BiometricUnlock } from './components/BiometricUnlock'
import WalletCard from './components/WalletCard'
import ActionButtons from './components/ActionButtons'
import { WalletDebugInfo } from './components/WalletDebugInfo'
import { MintDiscovery } from './components/MintDiscovery'
import { useWalletStore } from '../../store/walletStore'
import React from 'react'
import ManageBalances from './components/ManageBalances'
import BitcoinPriceCard from './components/BitcoinPriceCard'
import StatusScreen from '../../components/StatusScreen'
import ContactsView from './components/ContactsView'
import SupportView from './components/SupportView'

type StatusType = 'success' | 'error' | 'pending' | null;

export function HomeTabScreen() {
    const { refreshBalance, error } = useWalletStore()
    const [refreshing, setRefreshing] = React.useState(false)
    const [showStatus, setShowStatus] = React.useState<StatusType>(null)
    const toast = useToastController()

    React.useEffect(() => {
        if (error) {
            toast.show('Error', { message: error })
        }
    }, [error])

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        try {
            await refreshBalance()
        } finally {
            setRefreshing(false)
        }
    }, [refreshBalance])

    if (showStatus) {
        return (
            <StatusScreen
                visible={true}
                type={showStatus}
                title={
                    showStatus === 'success'
                        ? 'Payment Sent!'
                        : showStatus === 'error'
                            ? 'Payment Failed'
                            : 'Processing...'
                }
                message={
                    showStatus === 'success'
                        ? 'Your payment was sent successfully'
                        : showStatus === 'error'
                            ? 'Unable to complete the transaction'
                            : 'Please wait while we process your payment'
                }
                amount="1,234"
                onClose={() => setShowStatus(null)}
                onAction={showStatus === 'success' ? () => setShowStatus(null) : undefined}
                actionLabel={showStatus === 'success' ? 'View Details' : undefined}
            />
        );
    }

    return (
        <ScrollView
            bg="$background"
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />
            }
        >
            <YStack flex={1} items="center" gap="$4" px="$4" pt="$2" pb="$20">
                <WalletCard />
                <ActionButtons />
                <BitcoinPriceCard />
                <ManageBalances />
                <ContactsView />
                <SupportView />

                {/* Test Status Screens */}

                {/* Test Status Screens */}

                {/* <MintDiscovery /> */}
                {/* 

                <WalletDebugInfo /> */}
            </YStack>
        </ScrollView>
    )
}
