import React, { useEffect, useState } from 'react';
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

interface MintProfileScreenProps {
    url: string;
}

export function MintProfileScreen({ url }: MintProfileScreenProps) {
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
    const auditInfo = info.audit || null; // Will be null if mint doesn't provide it
    
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

                    {/* Audit Info Placeholder (Will show N/A since it's not commonly returned yet, but structurally ready) */}
                    {(auditInfo || true) && (
                        <YStack gap="$3">
                            <H4 color="$gray10" fontSize="$4">Audit Information</H4>
                            <ListTable>
                                <ListTableRow label="Success Rate" value={auditInfo?.successRate ? `${auditInfo.successRate}%` : 'N/A'} />
                                <ListTableRow label="Avg Uptime" value={auditInfo?.uptime ? `${auditInfo.uptime}%` : 'N/A'} />
                            </ListTable>
                        </YStack>
                    )}

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

            <YStack p="$4" bg="$background" borderTopWidth={1} borderTopColor="$gray4">
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
