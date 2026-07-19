import React, { useMemo } from 'react';
import { YStack, XStack, Text, Button, View, Separator, ScrollView, YGroup, Avatar } from 'tamagui';
import { Switch } from 'react-native';
import { Sprout, Zap, ShieldCheck, Lock, Clock } from "@tamagui/lucide-icons";
import { Spinner } from '~/components/UI/Spinner';
import { useWalletStore } from '~/store/walletStore';
import { useSettingsStore } from '~/store/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/bitcoinService';
import { currencyService, CurrencyCode, SUPPORTED_CURRENCIES } from '~/services/currencyService';
import { SendMode } from '~/components/SendMethodSelector';
import Blockies from '~/components/UI/Blockies';
import * as Haptics from 'expo-haptics';

interface ConfirmStageProps {
    amount: string;
    mintUrl: string;
    estimatedFee: number;
    sendMode: SendMode;
    useP2PK: boolean;
    setUseP2PK: (val: boolean) => void;
    expiryEnabled: boolean;
    setExpiryEnabled: (val: boolean) => void;
    nostrRecipientNpub?: string;
    nostrRecipientUsername?: string;
    receiverPubkey?: string;
    isLoading?: boolean;
    onConfirm: () => void;
    onBack: () => void;
}

export function ConfirmStage({
    amount,
    mintUrl,
    estimatedFee,
    sendMode,
    useP2PK,
    setUseP2PK,
    expiryEnabled,
    setExpiryEnabled,
    nostrRecipientNpub,
    nostrRecipientUsername,
    receiverPubkey,
    isLoading,
    onConfirm,
    onBack
}: ConfirmStageProps) {
    const sats = parseInt(amount, 10) || 0;
    const { mints } = useWalletStore();
    const { secondaryCurrency } = useSettingsStore();

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    });

    const fiatValue = useMemo(() => {
        if (!btcData?.price) return '0.00';
        const fiat = currencyService.convertSatsToCurrency(sats, btcData.price);
        return currencyService.formatValue(fiat, secondaryCurrency as CurrencyCode);
    }, [sats, btcData?.price, secondaryCurrency]);

    const normalizeUrl = (url: string) => url.replace(/\/$/, "");

    const activeMint = useMemo(() => {
        if (!mintUrl) return null;
        return mints.find((m) => normalizeUrl(m.mintUrl) === normalizeUrl(mintUrl));
    }, [mints, mintUrl]);

    const mintDisplayName = useMemo(() => {
        if (!mintUrl) return "Selected Mint";
        if (activeMint?.nickname) return activeMint.nickname;
        if (activeMint?.name) return activeMint.name;
        return mintUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    }, [activeMint, mintUrl]);

    const formattedSatsString = useMemo(() => {
        return sats.toLocaleString('en-US');
    }, [sats]);

    const recipientSeed = useMemo(() => {
        if (sendMode === 'nostr' && nostrRecipientNpub) return nostrRecipientNpub;
        if (sendMode === 'p2pk' && receiverPubkey) return receiverPubkey;
        return null;
    }, [sendMode, nostrRecipientNpub, receiverPubkey]);

    const displayRecipientText = useMemo(() => {
        if (sendMode === 'nostr') {
            return nostrRecipientUsername || (nostrRecipientNpub ? `${nostrRecipientNpub.slice(0, 10)}...` : '');
        }
        if (sendMode === 'p2pk' && receiverPubkey) {
            return `${receiverPubkey.slice(0, 10)}...`;
        }
        return '';
    }, [sendMode, nostrRecipientNpub, nostrRecipientUsername, receiverPubkey]);

    const methodTitle = useMemo(() => {
        if (sendMode === 'p2pk') return 'P2PK Send';
        if (sendMode === 'nostr') return 'Nostr Direct Send';
        return 'Standard Ecash Send';
    }, [sendMode]);

    return (
        <YStack flex={1} bg="$background">
            <ScrollView contentContainerStyle={{ paddingBottom: 180 } as any} showsVerticalScrollIndicator={false}>
                <YStack  gap="$4">
                    {/* Middle Amount Display */}
                    <YStack gap="$3" py="$6" items="center" justify="center">
                        <Text fontSize={52} fontFamily="$oswald" fontWeight="700" color="$accent3" lineHeight={54}>
                            {currencyService.formatSats(sats)}
                        </Text>
                        <Text color="$accent5" fontWeight="600" fontSize={16}>
                            ≈ {fiatValue} {secondaryCurrency}
                        </Text>
                    </YStack>

                    {/* Send Method Badge */}
                    <XStack
                        self="center"
                        items="center"
                        gap="$2"
                        bg="$accent9"
                        px="$4"
                        py="$3"
                        rounded="$10"
                    >
                        {sendMode === 'nostr' ? <Zap size={16} color="white" />
                            : sendMode === 'p2pk' ? <Lock size={16} color="white" />
                                : <Sprout size={16} color="white" />}
                        <Text
                            fontSize="$3"
                            fontWeight="700"
                            color="white"
                        >
                            {methodTitle}
                        </Text>
                    </XStack>

                    {/* Details List */}
                    <YStack bg="$gray2" rounded="$5" overflow="hidden" mb="$3">
                        <View p="$3" px="$4">
                            <Text fontSize="$3" fontWeight="700" color="$gray12">Details</Text>
                        </View>
                        <Separator borderColor="$borderColor" opacity={0.3} />
                        <YGroup separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
                            <DetailItem
                                label="Mint"
                                value={mintDisplayName}
                                icon={
                                    <Avatar rounded="$3" size="$1.5">
                                        <Avatar.Image src={activeMint?.icon} />
                                        <Avatar.Fallback bg="$green3" items="center" justify="center">
                                            <Sprout size={12} color="$green10" />
                                        </Avatar.Fallback>
                                    </Avatar>
                                }
                            />
                            <DetailItem
                                label="Estimated Fee"
                                value={estimatedFee > 0 ? `~${currencyService.formatSats(estimatedFee)}` : `${currencyService.formatSats(0)} (Free)`}
                                valueColor={estimatedFee > 0 ? "$orange10" : "$green11"}
                                icon={<ShieldCheck size={16} color="$green11" />}
                            />

                            {recipientSeed && (
                                <XStack justify="space-between" items="center" py="$3" px="$4">
                                    <Text fontSize="$3" color="$gray10" fontWeight="600">Recipient</Text>
                                    <XStack gap="$2" items="center">
                                        <Blockies seed={recipientSeed} size={6} scale={2} style={{ borderRadius: 2 }} />
                                        <Text fontSize="$3" fontWeight="800" color="$color" numberOfLines={1} style={{ maxWidth: 180 }}>
                                            {displayRecipientText}
                                        </Text>
                                    </XStack>
                                </XStack>
                            )}

                            {sendMode === 'nostr' && (
                                <XStack justify="space-between" items="center" py="$3" px="$4">
                                    <XStack gap="$2" items="center">
                                        <Lock size={16} color="$gray10" />
                                        <Text fontSize="$3" color="$gray10" fontWeight="600">P2PK Lock</Text>
                                    </XStack>
                                    <XStack gap="$2" items="center">
                                        <Text fontSize="$2" color={useP2PK ? '$green10' : '$gray10'} fontWeight="700">
                                            {useP2PK ? 'Secured' : 'Off'}
                                        </Text>
                                        <Switch
                                            value={useP2PK}
                                            onValueChange={setUseP2PK}
                                            trackColor={{ false: '#444', true: '#34C759' }}
                                            thumbColor="white"
                                        />
                                    </XStack>
                                </XStack>
                            )}

                            <XStack justify="space-between" items="center" py="$3" px="$4">
                                <XStack gap="$2" items="center">
                                    <Clock size={16} color="$gray10" />
                                    <Text fontSize="$3" color="$gray10" fontWeight="600">7 Days Expiry</Text>
                                </XStack>
                                <XStack gap="$2" items="center">
                                    <Text fontSize="$2" color={expiryEnabled ? '$green11' : '$gray10'} fontWeight="700">
                                        {expiryEnabled ? '7 Days' : 'Off'}
                                    </Text>
                                    <Switch
                                        value={expiryEnabled}
                                        onValueChange={setExpiryEnabled}
                                        trackColor={{ false: '#444', true: '#34C759' }}
                                        thumbColor="white"
                                    />
                                </XStack>
                            </XStack>
                        </YGroup>
                    </YStack>
                </YStack>
            </ScrollView>

            {/* Action Buttons */}
            <XStack position="absolute" b="$4" l="$1" r="$1" gap="$2">
                <Button
                    bg="$gray3"
                    color="$color"
                    size="$5"
                    flex={1}
                    height={55}
                    rounded="$4"
                    fontWeight="800"
                    disabled={isLoading}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onBack();
                    }}
                >
                    Go Back
                </Button>
                <Button
                    theme="accent"
                    size="$5"
                    flex={1}
                    height={55}
                    rounded="$4"
                    fontWeight="800"
                    disabled={isLoading}
                    icon={isLoading ? <Spinner size="small" color="$color" /> : undefined}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        onConfirm();
                    }}
                >
                    {isLoading ? 'Creating...' : 'Send'}
                </Button>
            </XStack>
        </YStack>
    );
}

function DetailItem({ label, value, icon, valueColor }: { label: string, value: string, icon?: React.ReactNode, valueColor?: string }) {
    return (
        <XStack justify="space-between" items="center" py="$3" px="$4">
            <Text fontSize="$3" color="$gray10" fontWeight="600">{label}</Text>
            <XStack gap="$2" items="center">
                {icon}
                <Text fontSize="$3" fontWeight="800" color={valueColor || "$color"} numberOfLines={1} style={{ maxWidth: 220 }}>
                    {value}
                </Text>
            </XStack>
        </XStack>
    );
}
