import { ChevronDown, Sprout, Plus, ShieldCheck, ShieldOff, Edit3, Building2 } from "@tamagui/lucide-icons";
import { Button, Text, YStack, XStack, View, Image, Avatar, Square } from "tamagui";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import * as Haptics from 'expo-haptics';
import React, { useRef, useMemo, useCallback } from 'react';
import { useWalletStore } from "../store/walletStore";
import AppBottomSheet, { AppBottomSheetRef } from "./UI/AppBottomSheet";
import EditNicknameModal, { EditNicknameModalRef } from "./EditNicknameModal";
import { Spinner } from "./UI/Spinner";
import { useRouter } from "expo-router";

export interface MintSelectorSheetProps {
    onSelect?: (mintUrl: string) => void;
    activeMintUrl?: string;
    showAllOption?: boolean;
}

export const MintSelectorSheet = React.forwardRef<AppBottomSheetRef, MintSelectorSheetProps>(
    ({ onSelect, activeMintUrl: propActiveMintUrl, showAllOption }, ref) => {
        const storeActiveMintUrl = useWalletStore(s => s.activeMintUrl);
        const balances = useWalletStore(s => s.balances);
        const mints = useWalletStore(s => s.mints);
        const setActiveMint = useWalletStore(s => s.setActiveMint);
        const router = useRouter();

        const activeMintUrl = propActiveMintUrl !== undefined ? propActiveMintUrl : storeActiveMintUrl;

        const handleSelectMint = useCallback((mintUrl: string) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (mintUrl !== 'all') {
                setActiveMint(mintUrl);
            }
            if (onSelect) {
                onSelect(mintUrl);
            }
            if (ref && 'current' in ref && ref.current) {
                (ref as React.RefObject<AppBottomSheetRef>).current?.dismiss();
            }
        }, [setActiveMint, onSelect, ref]);

        const handleAddMint = useCallback(() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (ref && 'current' in ref && ref.current) {
                (ref as React.RefObject<AppBottomSheetRef>).current?.dismiss();
            }
            setTimeout(() => {
                router.push('/(modals)/add-mint');
            }, 100);
        }, [router, ref]);

        const editNicknameRef = useRef<EditNicknameModalRef>(null);

        const handleEditNickname = useCallback((mint: any) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            editNicknameRef.current?.present(mint.mintUrl, mint.nickname);
        }, []);

        return (
            <>
                <AppBottomSheet ref={ref} snapPoints={["50%", "85%"]}>
                    <YStack p="$4" gap="$3" flex={1}>
                        <YStack gap="$1.5" mb="$2">
                            <Text fontWeight="800" fontSize="$6" color="$color">Select Mint</Text>
                            <Text fontSize="$3" color="$gray10">
                                Balances are shown for each mint. Transactions are processed on the active mint.
                            </Text>
                        </YStack>

                        <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                            <YStack gap="$2" pb="$4">
                                {showAllOption && (
                                    <XStack
                                        key="all-mints"
                                        justify="space-between"
                                        items="center"
                                        onPress={() => handleSelectMint('all')}
                                        pressStyle={{ opacity: 0.8, scale: 0.98 }}
                                        p="$3"
                                        borderWidth={1}
                                        borderColor={activeMintUrl === 'all' ? "$accentColor" : "$borderColor"}
                                        rounded="$7"
                                    >
                                        <XStack gap="$3" items="center">
                                            <View
                                                bg="$gray3"
                                                p="$2.5"
                                                rounded="$5"
                                                overflow="hidden"
                                                width={48}
                                                height={48}
                                                items="center"
                                                justify="center"
                                            >
                                                <Building2 size={20} color="$gray10" />
                                            </View>
                                            <YStack gap="$0.5">
                                                <Text fontWeight="600" fontSize="$4" numberOfLines={1}>
                                                    All Mints
                                                </Text>
                                                <Text fontSize="$3" color="$gray10">
                                                    Show history from all mints
                                                </Text>
                                            </YStack>
                                        </XStack>
                                        <XStack items="center" justify="center" pl="$2">
                                            {activeMintUrl === 'all' ? (
                                                <View
                                                    width={22}
                                                    height={22}
                                                    rounded={11}
                                                    borderWidth={2}
                                                    borderColor="$color"
                                                    items="center"
                                                    justify="center"
                                                >
                                                    <View
                                                        width={12}
                                                        height={12}
                                                        rounded={6}
                                                        bg="$color"
                                                    />
                                                </View>
                                            ) : (
                                                <View
                                                    width={22}
                                                    height={22}
                                                    rounded={11}
                                                    borderWidth={1.5}
                                                    borderColor="$gray8"
                                                />
                                            )}
                                        </XStack>
                                    </XStack>
                                )}

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
                                            pressStyle={{ opacity: 0.8, scale: 0.98 }}
                                            p="$3"
                                            borderWidth={1}
                                            borderColor={activeMintUrl === mint.mintUrl ? "$accentColor" : "$borderColor"}
                                            rounded="$7"
                                        >
                                            <XStack gap="$3" items="center">
                                                <View
                                                    bg={mint.trusted ? "$green3" : "$gray3"}
                                                    p={mint.icon ? "$0" : "$2"}
                                                    rounded="$5"
                                                    overflow="hidden"
                                                    width={48}
                                                    height={48}
                                                    items="center"
                                                    justify="center"
                                                >
                                                    {mint.icon ? (
                                                        <Image
                                                            source={{ uri: mint.icon }}
                                                            width={48}
                                                            height={48}
                                                            rounded="$5"
                                                            resizeMode="cover"
                                                        />
                                                    ) : mint.trusted ? (
                                                        <ShieldCheck size={20} color="$green10" />
                                                    ) : (
                                                        <ShieldOff size={20} color="$gray10" />
                                                    )}
                                                </View>
                                                <YStack gap="$0.5">
                                                    <XStack items="center" gap="$1">
                                                        <Text fontWeight="600" fontSize="$4" numberOfLines={1}>
                                                            {mint.nickname || mint.name || mint.mintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                                                        </Text>
                                                        <Button
                                                            size="$1.5"
                                                            circular
                                                            
                                                            icon={<Edit3 size={12}  />}
                                                            onPress={(e) => {
                                                                e.stopPropagation();
                                                                handleEditNickname(mint);
                                                            }}
                                                        />
                                                    </XStack>
                                                    <Text fontWeight="500" fontSize="$5" numberOfLines={1} color="$accent6">
                                                        {balances[mint.mintUrl] !== undefined ? `₿${balances[mint.mintUrl]}` : '₿0'}
                                                    </Text>
                                                </YStack>
                                            </XStack>
                                            <XStack items="center" justify="center" pl="$2">
                                                {activeMintUrl === mint.mintUrl ? (
                                                    <View
                                                        width={22}
                                                        height={22}
                                                        rounded={11}
                                                        borderWidth={2}
                                                        borderColor="$color"
                                                        items="center"
                                                        justify="center"
                                                    >
                                                        <View
                                                            width={12}
                                                            height={12}
                                                            rounded={6}
                                                            bg="$color"
                                                        />
                                                    </View>
                                                ) : (
                                                    <View
                                                        width={22}
                                                        height={22}
                                                        rounded={11}
                                                        borderWidth={1.5}
                                                        borderColor="$gray8"
                                                    />
                                                )}
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
);

export default function HomeHeaderMintSelector() {
    const activeMintUrl = useWalletStore(s => s.activeMintUrl);
    const mints = useWalletStore(s => s.mints);
    const refreshMintList = useWalletStore(s => s.refreshMintList);
    const isInitializing = useWalletStore(s => s.isInitializing);
    const isRefreshing = useWalletStore(s => s.isRefreshing);

    const isLoading = isInitializing || isRefreshing;
    const sheetRef = useRef<AppBottomSheetRef>(null);

    const normalizeUrl = (url: string) => url.replace(/\/$/, '');

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

            <MintSelectorSheet ref={sheetRef} />
        </>
    );
}