import { ChevronDown, Sprout, Plus, ShieldCheck, ShieldOff, Edit3, Check } from "@tamagui/lucide-icons";
import { Button, Text, YStack, XStack, View, Image, Avatar, Square } from "tamagui";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import * as Haptics from 'expo-haptics';
import React, { useRef, useMemo, useCallback } from 'react';
import { useWalletStore } from "../store/walletStore";
import AppBottomSheet, { AppBottomSheetRef } from "./UI/AppBottomSheet";
import EditNicknameModal, { EditNicknameModalRef } from "./EditNicknameModal";
import { initService } from "../services/core";
import { Spinner } from "./UI/Spinner";
import { useRouter } from "expo-router";

export default function HomeHeaderMintSelector() {
    // Granular selectors — only re-render when the specific field changes
    const activeMintUrl = useWalletStore(s => s.activeMintUrl);
    const balances = useWalletStore(s => s.balances);
    const mints = useWalletStore(s => s.mints);
    const setActiveMint = useWalletStore(s => s.setActiveMint);
    const refreshMintList = useWalletStore(s => s.refreshMintList);
    const isInitializing = useWalletStore(s => s.isInitializing);
    const isRefreshing = useWalletStore(s => s.isRefreshing);

    const isLoading = isInitializing || isRefreshing;
    const sheetRef = useRef<AppBottomSheetRef>(null);
    const editNicknameRef = useRef<EditNicknameModalRef>(null);
    const router = useRouter();

    // Normalize URLs for comparison
    const normalizeUrl = (url: string) => url.replace(/\/$/, '');

    // NOTE: Removed the eager refreshMintList() useEffect that ran on mount.
    // The mint list is already hydrated from SQLite persistence.
    // Refresh is triggered when the user opens the sheet instead.

    const activeMint = useMemo(() => {
        if (!activeMintUrl) return null;
        return mints.find(m => normalizeUrl(m.mintUrl) === normalizeUrl(activeMintUrl));
    }, [mints, activeMintUrl]);

    const displayUrl = activeMintUrl ? activeMintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') : "Select Mint";

    const displayName = useMemo(() => {
        if (!activeMintUrl) return "Select Mint";
        if (activeMint?.nickname) return activeMint.nickname;
        if (activeMint?.name) return activeMint.name;

        return displayUrl;
    }, [activeMint, activeMintUrl, displayUrl]);

    const handleSelectMint = useCallback((mintUrl: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setActiveMint(mintUrl);
        sheetRef.current?.dismiss();
    }, [setActiveMint]);

    const handleAddMint = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        sheetRef.current?.dismiss();
        setTimeout(() => {
            router.push('/(modals)/add-mint');
        }, 100);
    }, [router]);

    const handleEditNickname = useCallback((mint: any) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        editNicknameRef.current?.present(mint.mintUrl, mint.nickname);
    }, []);

    return (
        <>
            <Button
                size="$2.5"
                theme="gray"
                px={isLoading ? "$3" : "$1.5"}
                borderWidth={1}
                disabled={isLoading}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
                    refreshMintList();
                    sheetRef.current?.present();
                }}
                maxW={170}
                pressStyle={{ scale: 0.97, opacity: 0.9 }}
                icon={
                    isLoading ? (
                        <Spinner size={14} color="$gray10" />
                    ) : (
                        <Avatar rounded="$3" size="$1.5">
                            <Avatar.Image src={activeMint?.icon} />
                            <Avatar.Fallback backgroundColor="$color1" alignItems="center" justifyContent="center">
                                <Sprout size={14} color="$gray10" />
                            </Avatar.Fallback>
                        </Avatar>
                    )
                }
                iconAfter={
                    isLoading ? undefined : (
                        <Square size="$1.5" borderWidth={0.5} borderColor="$borderColor" bg="$gray2" rounded="$3">
                            <ChevronDown size={12} strokeWidth={2.5} color="$color" />
                        </Square>
                    )
                }
                textProps={{
                    fontSize: "$3",
                    fontWeight: "700",
                    maxW: 110,
                    numberOfLines: 1,
                }}
                ellipse
            >
                {isLoading ? "Loading..." : displayName}
            </Button>

            <AppBottomSheet ref={sheetRef} snapPoints={["50%", "85%"]}>
                <YStack p="$4" gap="$3" flex={1}>
                    <XStack justify="center" items="center" mb="$2">
                        <Button size="$3" fontWeight="bold" theme="accent" rounded="$10" onPress={handleAddMint} icon={<Plus size={18} color="$color" />}>
                            Add Mint
                        </Button>
                    </XStack>

                    <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                        <YStack gap="$3" pb="$4" >

                            {mints.length === 0 ? (
                                <YStack items="center" py="$6" gap="$2">
                                    <Sprout size={40} color="$gray8" />
                                    <Text color="$gray10">No mints added yet</Text>
                                </YStack>
                            ) : (
                                mints.map((mint) => (

                                    <XStack
                                        key={mint.mintUrl}
                                        justify="space-between"
                                        items="center"
                                        onPress={() => handleSelectMint(mint.mintUrl)}
                                        pressStyle={{ opacity: 0.7, scale: 0.98 }}
                                        p="$2"
                                        mx="$-2"
                                        rounded="$4"
                                    >
                                        <XStack gap="$3" items="center">
                                            <View
                                                bg={mint.trusted ? "$green4" : "$gray4"}
                                                p={mint.icon ? "$0" : "$2"}
                                                rounded="$4"
                                                overflow="hidden"
                                                width={50}
                                                height={50}
                                                items="center"
                                                justify="center"
                                            >
                                                {mint.icon ? (
                                                    <Image
                                                        source={{ uri: mint.icon }}
                                                        width={50}
                                                        height={50}
                                                        resizeMode="cover"
                                                    />
                                                ) : mint.trusted ? (
                                                    <ShieldCheck size={20} color="$green10" />
                                                ) : (
                                                    <ShieldOff size={20} color="$gray10" />
                                                )}
                                            </View>
                                            <YStack>
                                                <XStack items="center" gap="$2">
                                                    <Text fontWeight="600" fontSize="$4" numberOfLines={1}>
                                                        {mint.nickname || mint.name || mint.mintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                                                    </Text>
                                                    <Button
                                                        size="$2"
                                                        circular
                                                        chromeless
                                                        icon={<Edit3 size={14} color="$gray10" />}
                                                        onPress={(e) => {
                                                            e.stopPropagation();
                                                            handleEditNickname(mint);
                                                        }}
                                                    />
                                                </XStack>
                                                <Text fontWeight="bold" fontSize="$5" numberOfLines={1} color="$accent5">
                                                    {balances[mint.mintUrl] !== undefined ? `₿${balances[mint.mintUrl]}` : '₿0'}
                                                </Text>
                                            </YStack>
                                        </XStack>
                                        <XStack>
                                            <XStack items="center" justify="center">
                                                {mint.mintUrl === activeMintUrl ? (
                                                    <View bg="$accent4" p="$1.5" rounded="$10">
                                                        <Check size={18} color="$accent10" strokeWidth={4} />
                                                    </View>
                                                ) : undefined}

                                            </XStack>
                                        </XStack>
                                    </XStack>


                                ))

                            )}
                        </YStack>
                    </BottomSheetScrollView>



                    <Button
                        size="$4"
                        theme="gray"
                        onPress={handleAddMint}
                        icon={<Plus size={18} />}
                        mt="auto"
                    >
                        Add New Mint
                    </Button>
                </YStack>
            </AppBottomSheet>

            <EditNicknameModal ref={editNicknameRef} />
        </>
    );
}