import { RefreshControl } from 'react-native'
import { YStack, ScrollView } from 'tamagui'
import * as Haptics from 'expo-haptics'
import { useToastController } from '@tamagui/toast'
import WalletCard from './components/WalletCard'
import ActionButtons from './components/ActionButtons'
import { useWalletStore } from '../../store/walletStore'
import React from 'react'
import StatusScreen from '../../components/StatusScreen'
import SkeletonCard from '../../components/UI/SkeletonCard'

// Lazy-load below-the-fold components — they mount AFTER the above-fold
// content (WalletCard + ActionButtons) is already painted, so the user
// sees the critical content instantly.
const LazyBitcoinPriceCard = React.lazy(() => import('./components/BitcoinPriceCard'))
const LazyManageBalances = React.lazy(() => import('./components/ManageBalances'))
const LazyContactsView = React.lazy(() => import('./components/ContactsView'))
const LazySupportView = React.lazy(() => import('./components/SupportView'))

type StatusType = 'success' | 'error' | 'pending' | null;

/** Skeleton fallback shown while lazy components load */
function HomeSkeleton() {
    return (
        <YStack gap="$4" width="100%">
            <SkeletonCard height={120} rows={2} showAvatar={false} />
            <SkeletonCard height={160} rows={3} showAvatar={true} />
            <SkeletonCard height={100} rows={2} showAvatar={true} />
            <SkeletonCard height={80} rows={2} showAvatar={false} />
        </YStack>
    )
}

export function HomeTabScreen() {
    const refreshBalance = useWalletStore(s => s.refreshBalance)
    const error = useWalletStore(s => s.error)
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
                {/* Above-the-fold: renders immediately */}
                <WalletCard />
                <ActionButtons />

                {/* Below-the-fold: lazy-loaded with skeleton shimmer */}
                <React.Suspense fallback={<HomeSkeleton />}>
                    <LazyBitcoinPriceCard />
                    <LazyManageBalances />
                    <LazyContactsView />
                    <LazySupportView />
                </React.Suspense>
            </YStack>
        </ScrollView>
    )
}
