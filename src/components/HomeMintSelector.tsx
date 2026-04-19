import { ChevronDown, Sprout, Plus, ShieldCheck, ShieldOff, Edit3, Building2 } from "@tamagui/lucide-icons";
import { Button, Text, YStack, XStack, ListItem, Paragraph, View, Image, Avatar, Square } from "tamagui";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import * as Haptics from 'expo-haptics';
import { useRef, useEffect, useMemo } from 'react';
import { useWalletStore } from "../store/walletStore";
import AppBottomSheet, { AppBottomSheetRef } from "./UI/AppBottomSheet";
import EditNicknameModal, { EditNicknameModalRef } from "./EditNicknameModal";
import { initService } from "../services/core";
import { Spinner } from "./UI/Spinner";
import { useRouter } from "expo-router";

export default function HomeHeaderMintSelector() {
    const { activeMintUrl, balance, mints, setActiveMint, refreshMintList, isInitializing, isRefreshing } = useWalletStore();
    const isLoading = isInitializing || isRefreshing;
    const sheetRef = useRef<AppBottomSheetRef>(null);
    const editNicknameRef = useRef<EditNicknameModalRef>(null);
    const router = useRouter();

    // Normalize URLs for comparison
    const normalizeUrl = (url: string) => url.replace(/\/$/, '');

    // Refresh mint list when sheet opens
    useEffect(() => {
        if (initService.isInitialized()) {
            refreshMintList();
        }
    }, []);

    console.log('[HomeMintSelector] Current Mints:', mints.length, 'Active URL:', activeMintUrl);

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

    const handleSelectMint = (mintUrl: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setActiveMint(mintUrl);
        sheetRef.current?.dismiss();
    };

    const handleAddMint = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        sheetRef.current?.dismiss();
        setTimeout(() => {
            router.push('/(modals)/add-mint');
        }, 100);
    };

    const handleEditNickname = (mint: any) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        editNicknameRef.current?.present(mint.mintUrl, mint.nickname);
    };

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
                    <XStack justify="space-between" items="center" px="$3" mb="$2">
                        <Paragraph fontSize="$6" color="$accent5" fontWeight="bold">Your Mints</Paragraph>
                        <Button
                            size="$3"
                            rounded="$10"
                            theme="accent"
                            onPress={handleAddMint}
                            pressStyle={{ scale: 0.95 }}
                        >
                            Add Mint
                        </Button>
                    </XStack>

                    <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                        <YStack gap="$2" pb="$4">
                            {mints.length === 0 ? (
                                <YStack items="center" py="$6" gap="$2">
                                    <Sprout size={40} color="$gray8" />
                                    <Text color="$gray10">No mints added yet</Text>
                                </YStack>
                            ) : (
                                mints.map((mint) => (
                                    <ListItem
                                        key={mint.mintUrl}
                                        size="$4"
                                        px="$2"
                                        hoverTheme
                                        pressTheme
                                        theme="gray"
                                        rounded="$4"
                                        borderWidth={mint.mintUrl === activeMintUrl ? 1 : 0}
                                        borderColor={mint.mintUrl === activeMintUrl ? "$borderColor" : "$borderColor"}
                                        bg={mint.mintUrl === activeMintUrl ? "$color2" : "transparent"}
                                        onPress={() => handleSelectMint(mint.mintUrl)}
                                        icon={
                                            <View
                                                bg={mint.trusted ? "$green4" : "$gray4"}
                                                p={mint.icon ? "$0" : "$2"}
                                                rounded="$10"
                                                overflow="hidden"
                                                width={40}
                                                height={40}
                                                items="center"
                                                justify="center"
                                            >
                                                {mint.icon ? (
                                                    <Image
                                                        source={{ uri: mint.icon }}
                                                        width={40}
                                                        height={40}
                                                        resizeMode="cover"
                                                    />
                                                ) : mint.trusted ? (
                                                    <ShieldCheck size={20} color="$green10" />
                                                ) : (
                                                    <ShieldOff size={20} color="$gray10" />
                                                )}
                                            </View>
                                        }
                                        title={
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
                                        }
                                        subTitle={
                                            <Text fontSize="$2" color="$gray10" numberOfLines={1}>
                                                {mint.mintUrl.replace('https://', '')}
                                            </Text>
                                        }
                                        iconAfter={
                                            mint.mintUrl === activeMintUrl ? (
                                                <YStack items="flex-end" gap="$0">
                                                    <Text fontWeight="bold" fontSize="$6">{balance}</Text>
                                                    <Text fontSize="$2" opacity={0.6}>SATS</Text>
                                                </YStack>
                                            ) : undefined
                                        }
                                    />
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