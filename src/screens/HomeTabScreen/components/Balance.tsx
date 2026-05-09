import React from "react";
import { H1, H2, Paragraph, Text, View, XStack, YStack } from "tamagui";
import { useWalletStore } from "../../../store/walletStore";
import { RollingNumber } from "../../../components/UI/RollingNumber";
import { useSettingsStore } from "../../../store/settingsStore";
import { currencyService, CurrencyCode } from "../../../services/currencyService";
import { useQuery } from "@tanstack/react-query";
import { bitcoinService } from "../../../services/bitcoinService";
import * as Haptics from 'expo-haptics';

export default function Balance() {
    const balance = useWalletStore(s => s.balance);
    const activeMintUrl = useWalletStore(s => s.activeMintUrl);
    const refreshCounter = useWalletStore(s => s.refreshCounter);
    const mints = useWalletStore(s => s.mints);
    const balances = useWalletStore(s => s.balances);
    const isRestoring = useWalletStore(s => s.isRestoring);
    const { secondaryCurrency } = useSettingsStore();
    const [showAllMints, setShowAllMints] = React.useState(false);

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    })

    // Normalize URLs for comparison
    const normalizeUrl = (url: string) => url.replace(/\/$/, '');

    const activeMint = mints.find(m => activeMintUrl && normalizeUrl(m.mintUrl) === normalizeUrl(activeMintUrl));

    // Determine display values based on toggle state
    const currentBalance = showAllMints
        ? Object.values(balances).reduce((acc, val) => acc + val, 0)
        : balance;

    const displayName = showAllMints
        ? "All Mints"
        : (activeMint?.nickname || activeMint?.name || activeMintUrl?.replace(/^https?:\/\//, '').replace(/\/$/, '') || "No Mint Selected");

    const secondaryBalance = React.useMemo(() => {
        if (!btcData?.price) return 0;
        return currencyService.convertSatsToCurrency(currentBalance, btcData.price);
    }, [currentBalance, btcData?.price]);

    return (
        <YStack py="$2" gap="$2">
            <XStack width="100%" items="center" justify="space-between">
                <XStack items="center">
                    <Paragraph
                        color="$accent9"
                        px="$2"
                        py="$0.5"
                        rounded="$2"
                        bg="$gray5"
                        fontSize="$2"
                        fontWeight="600"
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setShowAllMints(prev => !prev);
                        }}
                        pressStyle={{ opacity: 0.7 }}
                        suppressHighlighting
                    >
                        {displayName}
                    </Paragraph>
                    {isRestoring && (
                        <XStack ml="$2" items="center" gap="$2">
                            <View
                                width={8}
                                height={8}
                                rounded="$10"
                                bg="$accent10"
                                animation="lazy"
                                opacity={0.8}
                            />
                            <Text fontSize="$2" color="$gray10" fontWeight="600">
                                Syncing...
                            </Text>
                        </XStack>
                    )}
                </XStack>
            </XStack>

            <XStack justify="space-between" py="$2" items="flex-end">
                <YStack>
                    <RollingNumber
                        value={currentBalance}
                        prefix="₿"
                        trigger={refreshCounter}
                        letterSpacing={-1}
                        fontSize={30}
                        fontWeight="900"
                        color="$accent3"
                        decimalOpacity={0.4}
                        showDecimals={false}
                    />
                </YStack>
                <Text color="$accent9" fontWeight="700">SATS</Text>
            </XStack>

            <RollingNumber
                value={secondaryBalance}
                trigger={refreshCounter}
                letterSpacing={-1}
                fontSize={16}
                fontWeight="900"
                color="$accent8"
                decimalOpacity={0.4}
                showDecimals={false}
            >
                {currencyService.formatValue(secondaryBalance, secondaryCurrency as CurrencyCode)}
            </RollingNumber>
        </YStack>
    )
}
