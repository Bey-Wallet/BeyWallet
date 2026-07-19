import React, { forwardRef } from 'react';
import { YStack, XStack, Text, View } from 'tamagui';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import AppBottomSheet, { AppBottomSheetRef } from '~/components/UI/AppBottomSheet';
import { SUPPORTED_CURRENCIES, CurrencyCode } from '~/services/currencyService';
import { useSettingsStore } from '~/store/settingsStore';
import * as Haptics from 'expo-haptics';

export const CurrencyModal = forwardRef<AppBottomSheetRef>((_, ref) => {
    const { secondaryCurrency, setSecondaryCurrency } = useSettingsStore();

    const handleSelect = (code: CurrencyCode) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSecondaryCurrency(code);
        (ref as React.RefObject<AppBottomSheetRef>).current?.dismiss();
    };

    return (
        <AppBottomSheet ref={ref} snapPoints={['75%', '90%']}>
            <YStack p="$4" gap="$3" flex={1}>
                <YStack gap="$1.5" mb="$2">
                    <Text fontSize="$6" fontWeight="800" color="$color">Select Currency</Text>
                    <Text fontSize="$3" color="$gray10">Choose your secondary display currency</Text>
                </YStack>

                <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                    <YStack gap="$2" pb="$4">
                        {/* None Option */}
                        <XStack
                            justify="space-between"
                            items="center"
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                setSecondaryCurrency('NONE');
                                (ref as React.RefObject<AppBottomSheetRef>).current?.dismiss();
                            }}
                            pressStyle={{ opacity: 0.8, scale: 0.98 }}
                            p="$3"
                            borderWidth={1}
                            borderColor={secondaryCurrency === 'NONE' ? "$accentColor" : "$borderColor"}
                            rounded="$7"
                        >
                            <XStack gap="$3" items="center">
                                <View
                                    bg={secondaryCurrency === 'NONE' ? "$accent3" : "$background"}
                                    rounded="$5"
                                    width={48}
                                    height={48}
                                    items="center"
                                    justify="center"
                                >
                                    <Text
                                        fontWeight="900"
                                        fontSize="$5"
                                        color={secondaryCurrency === 'NONE' ? "$accent11" : "$gray12"}
                                    >
                                        Ø
                                    </Text>
                                </View>
                                <YStack gap="$0.5">
                                    <Text fontWeight="600" fontSize="$4">
                                        None (Hide conversion)
                                    </Text>
                                    <Text fontSize="$3" color="$gray10">
                                        Do not convert or show secondary balances
                                    </Text>
                                </YStack>
                            </XStack>
                            <XStack items="center" justify="center" pl="$2">
                                {secondaryCurrency === 'NONE' ? (
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

                        {SUPPORTED_CURRENCIES.map((currency) => {
                            const isSelected = secondaryCurrency === currency.code;

                            return (
                                <XStack
                                    key={currency.code}
                                    justify="space-between"
                                    items="center"
                                    onPress={() => handleSelect(currency.code as CurrencyCode)}
                                    pressStyle={{ opacity: 0.8, scale: 0.98 }}
                                    p="$3"
                                    borderWidth={1}
                                    borderColor={isSelected ? "$accentColor" : "$borderColor"}
                                    rounded="$7"
                                    
                                >
                                    <XStack gap="$3" items="center">
                                        <View
                                            bg={isSelected ? "$accent3" : "$background"}
                                            rounded="$5"
                                            width={48}
                                            height={48}
                                            items="center"
                                            justify="center"
                                        >
                                            <Text
                                                fontWeight="900"
                                                fontSize="$5"
                                                color={isSelected ? "$accent11" : "$gray12"}
                                            >
                                                {currency.symbol}
                                            </Text>
                                        </View>
                                        <YStack gap="$0.5">
                                            <Text fontWeight="600" fontSize="$4">
                                                {currency.name}
                                            </Text>
                                            <Text fontSize="$3" color="$gray10">
                                                {currency.code} • {currency.locale.split('-')[1] || 'Global'}
                                            </Text>
                                        </YStack>
                                    </XStack>
                                    <XStack items="center" justify="center" pl="$2">
                                        {isSelected ? (
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
                            );
                        })}
                    </YStack>
                </BottomSheetScrollView>
            </YStack>
        </AppBottomSheet>
    );
});

CurrencyModal.displayName = 'CurrencyModal';
