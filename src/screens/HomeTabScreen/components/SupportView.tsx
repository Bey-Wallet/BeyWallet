import React, { useRef, useState } from "react";
import { ChevronRight } from "@tamagui/lucide-icons";
import { H6, XStack, YStack, ScrollView } from "tamagui";
import AppBottomSheet, { AppBottomSheetRef } from "~/components/UI/AppBottomSheet";
import * as Haptics from 'expo-haptics';
import { SUPPORT_ITEMS, SupportItem } from "./constants/support";

export default function SupportView() {
    const sheetRef = useRef<AppBottomSheetRef>(null);
    const [activeItem, setActiveItem] = useState<SupportItem | null>(null);

    const handleItemPress = (item: SupportItem) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setActiveItem(item);
        sheetRef.current?.present();
    };

    return (
        <YStack width="100%" gap="$4" px="$1">
            <XStack>
                <H6 color="$gray10" borderBottomWidth={1} borderBottomColor="$gray10" borderStyle='dashed'>Support</H6>
            </XStack>
            <YStack gap={"$3"}>
                {SUPPORT_ITEMS.map((item) => {
                    const IconComponent = item.icon;
                    return (
                        <XStack
                            key={item.id}
                            items="center"
                            justify="space-between"
                            onPress={() => handleItemPress(item)}
                            pressStyle={{ opacity: 0.7 }}
                            py="$1"
                            width="100%"
                        >
                            <XStack items="center" gap={12}>
                                <IconComponent size={20} color="$accent9" />
                                <H6 fontWeight="600" width="80%">{item.title}</H6>
                            </XStack>
                            <ChevronRight strokeWidth={3} color="$color" size={18} />
                        </XStack>
                    );
                })}
            </YStack>

            <AppBottomSheet ref={sheetRef}>
                <ScrollView showsVerticalScrollIndicator={false}>
                    {activeItem?.content}
                </ScrollView>
            </AppBottomSheet>
        </YStack>
    );
}