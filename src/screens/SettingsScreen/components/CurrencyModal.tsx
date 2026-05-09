import React, { forwardRef } from 'react';
import { YStack, Text, ListItem, YGroup, Separator } from 'tamagui';
import { Check } from '@tamagui/lucide-icons';
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
        <AppBottomSheet ref={ref} snapPoints={['80%']}>
            <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                <YStack p="$4" gap="$4" pb="$10">
                    <YStack gap="$1">
                        <Text fontSize="$6" fontWeight="700">Select Currency</Text>
                        <Text fontSize="$3" color="$gray11">Choose your secondary display currency</Text>
                    </YStack>

                    <YGroup bordered separator={<Separator />}>
                        {SUPPORTED_CURRENCIES.map((currency) => (
                            <YGroup.Item key={currency.code}>
                                <ListItem
                                    hoverStyle={{ bg: '$backgroundHover' }}
                                    pressStyle={{ bg: '$backgroundPress' }}
                                    title={currency.name}
                                    subTitle={`${currency.code} (${currency.symbol})`}
                                    iconAfter={secondaryCurrency === currency.code ? Check : null}
                                    onPress={() => handleSelect(currency.code as CurrencyCode)}
                                />
                            </YGroup.Item>
                        ))}
                    </YGroup>
                </YStack>
            </BottomSheetScrollView>
        </AppBottomSheet>
    );
});

CurrencyModal.displayName = 'CurrencyModal';
