import React, { forwardRef } from 'react';
import { YStack, Text, ListItem, YGroup, Separator } from 'tamagui';
import { Check } from '@tamagui/lucide-icons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import AppBottomSheet, { AppBottomSheetRef } from '~/components/UI/AppBottomSheet';
import { useSettingsStore } from '~/store/settingsStore';
import * as Haptics from 'expo-haptics';

export const SUPPORTED_LANGUAGES = [
    { code: 'en-US', name: 'English' },
    { code: 'es-ES', name: 'Español' },
    { code: 'fr-FR', name: 'Français' },
    { code: 'de-DE', name: 'Deutsch' },
    { code: 'it-IT', name: 'Italiano' },
    { code: 'pt-BR', name: 'Português (Brasil)' },
    { code: 'sv-SE', name: 'Svenska' },
    { code: 'cs-CZ', name: 'Čeština' },
    { code: 'tr-TR', name: 'Türkçe' },
    { code: 'el-GR', name: 'Ελληνικά' },
    { code: 'ar-SA', name: 'العربية' },
    { code: 'th-TH', name: 'ไทย' },
    { code: 'zh-CN', name: '中文' },
    { code: 'ja-JP', name: '日本語' },
];

export const LanguageModal = forwardRef<AppBottomSheetRef>((_, ref) => {
    const { language, setLanguage } = useSettingsStore();

    const handleSelect = (code: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setLanguage(code);
        (ref as React.RefObject<AppBottomSheetRef>).current?.dismiss();
    };

    return (
        <AppBottomSheet ref={ref} snapPoints={['80%']}>
            <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                <YStack p="$4" gap="$4" pb="$10">
                    <YStack gap="$1">
                        <Text fontSize="$6" fontWeight="700">Select Language</Text>
                        <Text fontSize="$3" color="$gray11">Choose your preferred app language</Text>
                    </YStack>

                    <YGroup bordered separator={<Separator />}>
                        {/* Device Default Option */}
                        <YGroup.Item>
                            <ListItem
                                hoverStyle={{ bg: '$backgroundHover' }}
                                pressStyle={{ bg: '$backgroundPress' }}
                                title="Device Default"
                                subTitle="Use phone settings"
                                iconAfter={!language ? Check : null}
                                onPress={() => handleSelect('')}
                            />
                        </YGroup.Item>

                        {/* Explicit Languages */}
                        {SUPPORTED_LANGUAGES.map((lang) => (
                            <YGroup.Item key={lang.code}>
                                <ListItem
                                    hoverStyle={{ bg: '$backgroundHover' }}
                                    pressStyle={{ bg: '$backgroundPress' }}
                                    title={lang.name}
                                    subTitle={lang.code}
                                    iconAfter={language === lang.code ? Check : null}
                                    onPress={() => handleSelect(lang.code)}
                                />
                            </YGroup.Item>
                        ))}
                    </YGroup>
                </YStack>
            </BottomSheetScrollView>
        </AppBottomSheet>
    );
});

LanguageModal.displayName = 'LanguageModal';
