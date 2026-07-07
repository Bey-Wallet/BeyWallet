import {
  ChevronDown,
  Sprout,
  Plus,
  ShieldCheck,
  ShieldOff,
  Edit3,
  Landmark,
  X,
} from "@tamagui/lucide-icons";
import {
  Button,
  Text,
  YStack,
  XStack,
  View,
  Image,
  Avatar,
  Square,
} from "tamagui";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import React, { useRef, useMemo, useCallback, useState, useEffect } from "react";
import * as Network from "expo-network";
import { useWalletStore } from "../store/walletStore";
import AppBottomSheet, { AppBottomSheetRef } from "./UI/AppBottomSheet";
import EditNicknameModal, { EditNicknameModalRef } from "./EditNicknameModal";
import { Spinner } from "./UI/Spinner";
import { useRouter } from "expo-router";

export interface MintSelectorSheetProps {
  onSelect?: (mintUrl: string) => void;
  activeMintUrl?: string;
  showAllOption?: boolean;
  changeGlobalActiveMint?: boolean;
}

export const MintSelectorSheet = React.forwardRef<
  AppBottomSheetRef,
  MintSelectorSheetProps
>(({ onSelect, activeMintUrl: propActiveMintUrl, showAllOption, changeGlobalActiveMint = true }, ref) => {
  const storeActiveMintUrl = useWalletStore((s) => s.activeMintUrl);
  const balances = useWalletStore((s) => s.balances);
  const mints = useWalletStore((s) => s.mints);
  const setActiveMint = useWalletStore((s) => s.setActiveMint);
  const router = useRouter();

  const activeMintUrl =
    propActiveMintUrl !== undefined ? propActiveMintUrl : storeActiveMintUrl;

  const handleSelectMint = useCallback(
    (mintUrl: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (mintUrl !== "all" && changeGlobalActiveMint) {
        setActiveMint(mintUrl);
      }
      if (onSelect) {
        onSelect(mintUrl);
      }
      if (ref && "current" in ref && ref.current) {
        (ref as React.RefObject<AppBottomSheetRef>).current?.dismiss();
      }
    },
    [setActiveMint, onSelect, ref, changeGlobalActiveMint],
  );

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (ref && "current" in ref && ref.current) {
      (ref as React.RefObject<AppBottomSheetRef>).current?.dismiss();
    }
  }, [ref]);

  const handleAddMint = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (ref && "current" in ref && ref.current) {
      (ref as React.RefObject<AppBottomSheetRef>).current?.dismiss();
    }
    setTimeout(() => {
      router.push("/(modals)/add-mint");
    }, 100);
  }, [router, ref]);

  const editNicknameRef = useRef<EditNicknameModalRef>(null);

  const handleEditNickname = useCallback((mint: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    editNicknameRef.current?.present(mint.mintUrl, mint.nickname);
  }, []);

  const snapPoints = useMemo(() => {
    const itemCount = mints.length + (showAllOption ? 1 : 0);
    if (itemCount === 0) return ["32%"];
    if (itemCount === 1) return ["38%"];
    if (itemCount === 2) return ["48%"];
    if (itemCount === 3) return ["58%"];
    if (itemCount === 4) return ["68%"];
    return ["80%"];
  }, [mints.length, showAllOption]);

  return (
    <>
      <AppBottomSheet ref={ref} snapPoints={snapPoints} backgroundColor="$gray2">
        <YStack p="$4" pt="$2" gap="$4" flex={1}>
          {/* Custom Header matching ActionSelectorSheet */}
          <XStack items="center" justify="space-between" width="100%" pb="$2">
            <XStack items="center" justify="center" gap="$3">

              <Button
                circular
                size="$4"
                bg="$gray5"
                pressStyle={{ scale: 0.95, bg: "$gray5" }}
                icon={<X size={20} color="$color" strokeWidth={3} />}
                onPress={handleClose}
              />
              <Text fontSize="$6" fontWeight="800" color="$accent1">
                Select Mint
              </Text>
            </XStack>
            <Button
              rounded="$10"
              size="$4"
              fontSize="$5"
              fontWeight="800"
              bg="$gray5"
              pressStyle={{ scale: 0.95, bg: "$gray5" }}
              icon={<Plus size={20} color="$color" strokeWidth={3} />}
              onPress={handleAddMint}
            >
              Add
            </Button>
          </XStack>

          <BottomSheetScrollView showsVerticalScrollIndicator={false}>
            <YStack gap="$2" pb="$4">
              {showAllOption && (
                <XStack
                  key="all-mints"
                  justify="space-between"
                  items="center"
                  onPress={() => handleSelectMint("all")}
                  pressStyle={{ scale: 0.98, bg: "$gray4" }}
                  p="$3"
                  bg="$gray4"
                  borderWidth={1.5}
                  borderColor={
                    activeMintUrl === "all" ? "$accentColor" : "transparent"
                  }
                  rounded="$6"
                >
                  <XStack gap="$3" items="center" flex={1}>
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
                      <Landmark size={20} color="$gray10" />
                    </View>
                    <YStack gap="$0.5" flex={1}>
                      <Text fontWeight="700" fontSize="$5" color="$accent3" numberOfLines={1}>
                        All Mints
                      </Text>
                      <Text fontSize="$3" color="$gray10">
                        Show history from all mints
                      </Text>
                    </YStack>
                  </XStack>
                  <XStack items="center" justify="center" pl="$2">
                    {activeMintUrl === "all" ? (
                      <View
                        width={22}
                        height={22}
                        rounded={11}
                        borderWidth={2}
                        borderColor="$color"
                        items="center"
                        justify="center"
                      >
                        <View width={12} height={12} rounded={6} bg="$color" />
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
                    pressStyle={{ scale: 0.98, bg: "$gray4" }}
                    p="$3"
                    bg="$gray4"
                    borderWidth={1.5}
                    borderColor={
                      activeMintUrl === mint.mintUrl
                        ? "$accentColor"
                        : "transparent"
                    }
                    rounded="$6"
                  >
                    <XStack gap="$3" items="center" flex={1}>
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
                      <YStack gap="$0.5" flex={1}>
                        <XStack items="center" gap="$1.5">
                          <Text
                            fontWeight="700"
                            fontSize="$5"
                            color="$accent3"
                            numberOfLines={1}
                            flexShrink={1}
                          >
                            {mint.nickname ||
                              mint.name ||
                              mint.mintUrl
                                .replace(/^https?:\/\//, "")
                                .replace(/\/$/, "")}
                          </Text>
                          <Button
                            size="$1.5"
                            circular
                            chromeless
                            icon={<Edit3 size={12} color="$gray10" />}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleEditNickname(mint);
                            }}
                          />
                        </XStack>
                        <Text
                          fontWeight="600"
                          fontSize="$4"
                          numberOfLines={1}
                          color="$accent6"
                        >
                          {balances[mint.mintUrl] !== undefined
                            ? `₿${balances[mint.mintUrl]}`
                            : "₿0"}
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
        </YStack>
      </AppBottomSheet>
      <EditNicknameModal ref={editNicknameRef} />
    </>
  );
});

export default function HomeHeaderMintSelector() {
  const activeMintUrl = useWalletStore((s) => s.activeMintUrl);
  const mints = useWalletStore((s) => s.mints);
  const refreshMintList = useWalletStore((s) => s.refreshMintList);
  const isInitializing = useWalletStore((s) => s.isInitializing);
  const isRefreshing = useWalletStore((s) => s.isRefreshing);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const checkNetwork = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        setIsOffline(!state.isConnected || !state.isInternetReachable);
      } catch (e) {
        setIsOffline(false);
      }
    };
    checkNetwork();
    const interval = setInterval(checkNetwork, 4000);
    return () => clearInterval(interval);
  }, []);

  const isLoading = isInitializing || isRefreshing;
  const sheetRef = useRef<AppBottomSheetRef>(null);

  const normalizeUrl = (url: string) => url.replace(/\/$/, "");

  const activeMint = useMemo(() => {
    if (!activeMintUrl) return null;
    return mints.find(
      (m) => normalizeUrl(m.mintUrl) === normalizeUrl(activeMintUrl),
    );
  }, [mints, activeMintUrl]);

  const displayUrl = activeMintUrl
    ? activeMintUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")
    : "Select Mint";

  const displayName = useMemo(() => {
    if (!activeMintUrl) return "Select Mint";
    if (activeMint?.nickname) return activeMint.nickname;
    if (activeMint?.name) return activeMint.name;

    return displayUrl;
  }, [activeMint, activeMintUrl, displayUrl]);

  return (
    <>
      <Button
        size="$3"
        rounded="$4"
        bg={isOffline ? "$red10" : "$blue10"}
        color="white"
        px={isLoading ? "$3" : "$1.5"}
        borderWidth={0}
        disabled={isLoading}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
          refreshMintList();
          sheetRef.current?.present();
        }}
        maxW={170}
        pressStyle={{ scale: 0.97, opacity: 0.95, bg: isOffline ? "$red11" : "$blue11" }}
        icon={
          isLoading ? (
            <Spinner size={14} color="white" />
          ) : (
            <Avatar rounded="$3" size="$2">
              <Avatar.Image src={activeMint?.icon} />
              <Avatar.Fallback
                backgroundColor="rgba(255,255,255,0.2)"
                alignItems="center"
                justifyContent="center"
              >
                <Sprout size={14} color="white" />
              </Avatar.Fallback>
            </Avatar>
          )
        }
        iconAfter={
          isLoading ? undefined : (
            <Square
              size="$2"
              borderWidth={0.5}
              borderColor="rgba(255,255,255,0.2)"
              bg="rgba(255,255,255,0.15)"
              rounded="$3"
            >
              <ChevronDown size={16} strokeWidth={3} color="white" />
            </Square>
          )
        }
        textProps={{
          fontSize: "$3",
          fontWeight: "700",
          maxW: 110,
          numberOfLines: 1,
          color: "white",
        }}
        ellipse
      >
        {isLoading ? "Loading..." : displayName}
      </Button>

      <MintSelectorSheet ref={sheetRef} />
    </>
  );
}
