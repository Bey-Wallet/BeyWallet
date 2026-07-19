import React, { useEffect, useState, useMemo } from 'react';
import { YStack, XStack, Text, Button, H2, H3, H4, Separator, ScrollView, View, Image, Card } from 'tamagui';
import { Spinner } from '../../components/UI/Spinner';
import { Link, Mail, Globe, Info, Copy, Check, ChevronLeft, Sprout, Share2, MessageSquare, ShieldCheck, Cpu, Plus, ShieldOff } from '@tamagui/lucide-icons';
import { useRouter, Stack } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import QRCode from "react-native-qrcode-svg";
import { mintRecommendationService } from '../../services/mintRecommendationService';
import { useToastController } from '@tamagui/toast';
import { useQuery } from '@tanstack/react-query';
import { useWalletStore } from '../../store/walletStore';
import { AppBottomSheetRef } from '../../components/UI/AppBottomSheet';
import AddMintModal, { AddMintModalRef } from '../../components/AddMintModal';
import EditNicknameModal, { EditNicknameModalRef } from '../../components/EditNicknameModal';
import { ListTable, ListTableRow } from '../../components/UI/ListTable';
import * as Sharing from 'expo-sharing';
import { Share as RNShare, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface MintProfileScreenProps {
    url: string;
}

export function MintProfileScreen({ url }: MintProfileScreenProps) {
    const insets = useSafeAreaInsets();
    const [showQr, setShowQr] = useState(false);
    const router = useRouter();
    const toast = useToastController();
    const { addMint, mints } = useWalletStore();

    const addMintRef = React.useRef<AddMintModalRef>(null);

    const normalizeUrl = (url: string) => url.replace(/\/$/, '');
    const walletMint = mints.find(m => normalizeUrl(m.mintUrl) === normalizeUrl(url));
    const isAlreadyAdded = !!walletMint;
    const isTrusted = walletMint?.trusted ?? false;

    const { removeMint } = useWalletStore();
    const editNicknameRef = React.useRef<EditNicknameModalRef>(null);

    const handleAction = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (!isAlreadyAdded) {
            addMintRef.current?.present(url);
        } else if (!isTrusted) {
            addMintRef.current?.present(url);
        }
    };

    const handleShare = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            await RNShare.share({ message: url });
        } catch (error) {
            handleCopy(url, 'URL');
        }
    };

    const handleDelete = () => {
        Alert.alert('Remove Mint', 'Are you sure you want to remove this mint from your wallet?', [
            { text: 'Cancel', style: 'cancel' },
            { 
                text: 'Remove', 
                style: 'destructive', 
                onPress: async () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    try {
                        await removeMint(url);
                        toast.show('Mint Removed', { message: 'Mint was removed successfully.' });
                        router.back();
                    } catch (e: any) {
                        toast.show('Error', { message: e.message || 'Failed to remove mint.' });
                    }
                }
            }
        ]);
    };

    const { data: info, isLoading, error: fetchError } = useQuery({
        queryKey: ['mint-metadata', url],
        queryFn: () => mintRecommendationService.fetchMintMetadata(url),
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
        retry: 2,
    });

    // Auditor queries
    const { data: auditorMint } = useQuery({
        queryKey: ['auditor-mint', url],
        queryFn: async () => {
            try {
                const response = await fetch(`https://api.audit.8333.space/mints/url?url=${encodeURIComponent(url || '')}`);
                if (response.ok) {
                    return await response.json();
                }
            } catch (e) {
                console.error('Error fetching auditor mint info:', e);
            }
            return null;
        },
        enabled: !!url,
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });

    const { data: auditorSwaps = [] } = useQuery({
        queryKey: ['auditor-swaps', auditorMint?.id],
        queryFn: async () => {
            if (!auditorMint?.id) return [];
            try {
                const response = await fetch(`https://api.audit.8333.space/swaps/mint/${auditorMint.id}?skip=0&limit=30`);
                if (response.ok) {
                    return await response.json();
                }
            } catch (e) {
                console.error('Error fetching auditor swaps:', e);
            }
            return [];
        },
        enabled: !!auditorMint?.id,
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });

    const { successRate, averageTime, riskLabel, uptimeColor, sortedSwaps } = useMemo(() => {
        if (!auditorMint || !auditorSwaps || auditorSwaps.length === 0) {
            return {
                successRate: null,
                averageTime: null,
                riskLabel: 'Not Audited',
                uptimeColor: '$gray10',
                sortedSwaps: [],
            };
        }

        const successfulSwaps = auditorSwaps.filter((s: any) => s.state === 'OK');
        const rate = Math.round((successfulSwaps.length / auditorSwaps.length) * 100);

        const successfulSwapsWithTime = successfulSwaps.filter((s: any) => s.time_taken);
        const avgTime = successfulSwapsWithTime.length > 0
            ? successfulSwapsWithTime.reduce((sum: number, s: any) => sum + s.time_taken, 0) / successfulSwapsWithTime.length
            : null;

        let risk = 'Low Risk';
        let color = '$green10';
        if (rate >= 99.0) {
            risk = 'Low Risk';
            color = '$green10';
        } else if (rate >= 95.0) {
            risk = 'Medium Risk';
            color = '$orange10';
        } else {
            risk = 'High Risk';
            color = '$red10';
        }

        const sorted = [...auditorSwaps].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        return {
            successRate: rate,
            averageTime: avgTime,
            riskLabel: risk,
            uptimeColor: color,
            sortedSwaps: sorted,
        };
    }, [auditorMint, auditorSwaps]);

    const uptimeBars = useMemo(() => {
        const totalBars = 30;
        const bars: React.ReactNode[] = [];

        // If not audited, show all neutral gray bars
        if (!auditorMint || sortedSwaps.length === 0) {
            return Array.from({ length: totalBars }).map((_, idx) => (
                <View
                    key={idx}
                    flex={1}
                    height={12}
                    bg="$gray5"
                    rounded={2}
                    opacity={0.4}
                />
            ));
        }

        // Pad with placeholders on the left if we have fewer than 30 swaps
        const paddingCount = Math.max(0, totalBars - sortedSwaps.length);
        for (let i = 0; i < paddingCount; i++) {
            bars.push(
                <View
                    key={`pad-${i}`}
                    flex={1}
                    height={12}
                    bg="$gray5"
                    rounded={2}
                    opacity={0.4}
                />
            );
        }

        // Add real swap bars (Green for OK, Red for any error status)
        sortedSwaps.forEach((swap: any) => {
            const isOk = swap.state === 'OK';
            const barColor = isOk ? '$green9' : '$red9';

            bars.push(
                <View
                    key={`swap-${swap.id}`}
                    flex={1}
                    height={12}
                    bg={barColor}
                    rounded={2}
                    opacity={0.85}
                />
            );
        });

        return bars;
    }, [auditorMint, sortedSwaps]);

    const handleCopy = async (text: string, label: string) => {
        await Clipboard.setStringAsync(text);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast.show('Copied', {
            message: `${label} copied to clipboard`,
        });
    };

    if (isLoading) {
        return (
            <YStack flex={1} items="center" justify="center" bg="$background">
                <Spinner size="large" color="$accentColor" />
                <Text mt="$4" color="$gray10">Fetching mint details...</Text>
            </YStack>
        );
    }

    if (fetchError || !info) {
        return (
            <YStack flex={1} items="center" justify="center" bg="$background" p="$4" gap="$4">
                <Text color="$red10">Failed to fetch mint information.</Text>
                <Button onPress={() => router.back()}>Go Back</Button>
            </YStack>
        );
    }

    const name = walletMint?.nickname || info.name || (() => {
        try { return new URL(url).hostname }
        catch (e) { return url }
    })();
    const description = info.description || info.description_long;
    const motd = info.motd;
    const version = info.version;
    const nuts = info.nuts || {};
    
    // Safely extract icon from store or the fetched v1/info metadata
    const iconToUse = walletMint?.icon || info.icon_url || info.picture || info.icon;


    const hostname = (() => {
        try { return new URL(url).hostname }
        catch (e) { return url }
    })();

    return (
        <YStack flex={1} bg="$background">
            <Stack.Screen
                options={{
                    title: name,
                    headerRight: () => (
                        <Button
                            circular
                            size="$3"
                            chromeless
                            icon={<Share2 size={20} color="$color" />}
                            onPress={() => handleCopy(url, 'Mint URL')}
                        />
                    )
                }}
            />

            <ScrollView flex={1} showsVerticalScrollIndicator={false}>
                <YStack px="$4" pb="$10" gap="$6">
                    {/* Header Section */}
                    <YStack items="center" gap="$3">
                        <View
                            width={100}
                            height={100}
                            rounded="$5"
                            bg="$gray3"
                            items="center"
                            justify="center"
                            overflow="hidden"
                            borderWidth={1}
                            borderColor="$color5"
                        >
                            {iconToUse ? (
                                <Image source={{ uri: iconToUse, width: 100, height: 100 }} />
                            ) : (
                                <Sprout size={60} color="$accentColor" />
                            )}
                        </View>
                        <XStack items="center" gap="$2">
                            <H2 text="center">{name}</H2>
                            {isTrusted ? (
                                <ShieldCheck size={24} color="$green10" />
                            ) : isAlreadyAdded ? (
                                <ShieldOff size={24} color="$orange10" />
                            ) : null}
                        </XStack>
                        <XStack
                            bg="$gray3"
                            px="$3"
                            py="$1"
                            rounded={100}
                            items="center"
                            gap="$2"
                            onPress={() => handleCopy(url, 'URL')}
                        >
                            <Globe size={14} color="$gray10" />
                            <Text color="$gray10" fontSize="$3">{hostname}</Text>
                        </XStack>
                    </YStack>

                    {/* MOTD */}
                    {motd && (
                        <View bg="$color5" rounded="$4" p="$4" >
                            <XStack gap="$3">
                                <MessageSquare color="$color" size={20} />
                                <YStack flex={1}>
                                    <Text fontWeight="bold" color="$color">Message of the Day</Text>
                                    <Text color="$color" mt="$1">{motd}</Text>
                                </YStack>
                            </XStack>
                        </View>
                    )}

                    {/* Description */}
                    {description && (
                        <YStack gap="$2">
                            <H4 color="$gray10" fontSize="$4">About</H4>
                            <Text lineHeight={22} color="$color">{description}</Text>
                        </YStack>
                    )}

                    {/* General Metadata lists */}
                    <YStack gap="$3">
                        <H4 color="$gray10" fontSize="$4">Mint Details</H4>
                        <ListTable>
                            <ListTableRow label="URL" value={hostname} isCopyable copyValue={url} />
                            {version && <ListTableRow label="Version" value={version} />}
                            <ListTableRow label="Supported NUTs" value={Object.keys(nuts).length} rightContent={
                                <XStack gap="$1" items="center">
                                    <Text fontSize="$4" fontWeight="600" color="$color">{Object.keys(nuts).length}</Text>
                                    <View bg="$gray4" px="$2" py="$1" rounded="$2"><Text fontSize="$2" fontWeight="800">NUTs</Text></View>
                                </XStack>
                            } />
                            <ListTableRow label="Currencies" rightContent={
                                <XStack gap="$1" items="center">
                                    <View bg="$gray4" px="$2" py="$1" rounded="$2"><Text fontSize="$2" fontWeight="800">SAT</Text></View>
                                    {nuts['14']?.supported && <View bg="$gray4" px="$2" py="$1" rounded="$2"><Text fontSize="$2" fontWeight="800">USD</Text></View>}
                                </XStack>
                            } />
                        </ListTable>
                    </YStack>

                    {/* Audit Info Section */}
                    <YStack gap="$3">
                        <H4 color="$gray10" fontSize="$4">Audit Information</H4>
                        <ListTable>
                            <YStack py="$3" px="$4" gap="$2">
                                <XStack justify="space-between" items="center">
                                    <Text fontSize="$4" color="$gray10" fontWeight="600">Uptime</Text>
                                    <Text fontSize="$4" fontWeight="700" color={uptimeColor}>
                                        {successRate !== null ? `${successRate}% (${riskLabel})` : 'Not Audited'}
                                    </Text>
                                </XStack>
                                <XStack gap="$1" items="center" width="100%" pt="$1">
                                    {uptimeBars}
                                </XStack>
                            </YStack>
                            <ListTableRow
                                label="Success Rate"
                                value={successRate !== null ? `${successRate}%` : 'Not Audited'}
                            />
                            {averageTime !== null && (
                                <ListTableRow
                                    label="Avg Response Time"
                                    value={`${(averageTime / 1000).toFixed(2)}s`}
                                />
                            )}
                            {auditorMint && auditorMint.balance !== undefined && (
                                <ListTableRow
                                    label="Auditor Balance"
                                    value={`${auditorMint.balance} sats`}
                                />
                            )}
                            {auditorMint && auditorMint.sum_donations !== undefined && (
                                <ListTableRow
                                    label="Auditor Donations"
                                    value={`${auditorMint.sum_donations} sats`}
                                />
                            )}
                        </ListTable>
                    </YStack>

                    {/* Actions List */}
                    <YStack gap="$3">
                        <H4 color="$gray10" fontSize="$4">Actions</H4>
                        <ListTable>
                            {isAlreadyAdded && (
                                <ListTableRow 
                                    label="Edit Name" 
                                    icon={Info} 
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        editNicknameRef.current?.present(url, walletMint?.nickname || info.name);
                                    }} 
                                />
                            )}
                            <ListTableRow 
                                label="Copy URL" 
                                icon={Copy} 
                                onPress={() => handleCopy(url, 'Mint URL')} 
                            />
                            <ListTableRow 
                                label="Share Mint" 
                                icon={Share2} 
                                onPress={handleShare} 
                            />
                            {isAlreadyAdded && (
                                <ListTableRow 
                                    label="Delete from Wallet" 
                                    iconColor="$red10" 
                                    labelColor="$red10" 
                                    onPress={handleDelete} 
                                />
                            )}
                        </ListTable>
                    </YStack>

                    {/* Contact (if available) */}
                    {info.contact && info.contact.length > 0 && (
                        <YStack gap="$3">
                            <H4 color="$gray10" fontSize="$4">Contact & Support</H4>
                            <ListTable>
                                {info.contact.map((c: any, i: number) => {
                                    const method = Array.isArray(c) ? c[0] : (c.method || 'Contact');
                                    const contactInfo = Array.isArray(c) ? c[1] : (c.info || '');
                                    if (!contactInfo) return null;
                                    return (
                                        <ListTableRow 
                                            key={i} 
                                            label={method.charAt(0).toUpperCase() + method.slice(1)} 
                                            value={contactInfo} 
                                            isCopyable 
                                        />
                                    );
                                })}
                            </ListTable>
                        </YStack>
                    )}
                </YStack>
            </ScrollView>

            <YStack p="$4" pb={insets.bottom || '$4'} bg="$background" borderTopWidth={1} borderTopColor="$gray4">
                <Button
                    size="$4"
                    fontWeight="bold"
                    theme={isTrusted ? 'green' : isAlreadyAdded ? 'orange' : 'accent'}
                    disabled={isTrusted}
                    icon={isTrusted ? <ShieldCheck size={18} /> : isAlreadyAdded ? <ShieldOff size={18} /> : <Plus size={18} />}
                    onPress={handleAction}
                >
                    {isTrusted ? 'Mint Trusted' : isAlreadyAdded ? 'Trust this Mint' : 'Connect to this Mint'}
                </Button>
            </YStack>

            <AddMintModal ref={addMintRef} />
            <EditNicknameModal ref={editNicknameRef} />
        </YStack>
    );
}
