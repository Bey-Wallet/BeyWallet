import React, { useRef, useState } from 'react';
import { YStack, ScrollView, Text } from 'tamagui';
import { ShieldCheck, Fingerprint, Palette, Bell, Globe, Info, Trash2, Download, Server, AtSign, RefreshCw } from '@tamagui/lucide-icons';
import { ThemeModal } from './components/ThemeModal';
import { CurrencyModal } from './components/CurrencyModal';
import { NotificationsModal } from './components/NotificationsModal';
import { BiometricModal } from './components/BiometricModal';
import { MintModal } from './components/MintModal';
import { SettingSection } from './components/SettingSection';
import { DeleteWalletSheet } from './components/DeleteWalletSheet';
import { SettingSectionConfig } from './components/types';
import NostrIcon from '~/components/icons/NostrIcon';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '~/store/settingsStore';
import { useRouter } from 'expo-router';
import { currencyService } from '~/services/currencyService';
import { biometricService } from '~/services/biometricService';
import { seedService } from '~/services/seedService';
import { initService } from '~/services/core';
import { useOnboardingStore } from '~/store/onboardingStore';
import { AppBottomSheetRef } from '~/components/UI/AppBottomSheet';
import { ActivityIndicator, Alert, DevSettings } from 'react-native';
import { walletFileService } from '~/services/walletFileService';
import Constants from 'expo-constants';
import { useNip05Lookup } from '~/hooks/useNip05Lookup';
import * as Updates from 'expo-updates';

const APP_VERSION = Constants.expoConfig?.version ?? '1.1.0';

export function SettingsScreen() {
    const router = useRouter();
    const themeSheetRef = useRef<AppBottomSheetRef>(null);
    const currencySheetRef = useRef<AppBottomSheetRef>(null);
    const mintSheetRef = useRef<AppBottomSheetRef>(null);
    const notificationsSheetRef = useRef<AppBottomSheetRef>(null);
    const biometricSheetRef = useRef<AppBottomSheetRef>(null);
    const deleteSheetRef = useRef<AppBottomSheetRef>(null);

    const { theme, secondaryCurrency, defaultMintUrl, biometricEnabled } = useSettingsStore();
    const { nip05: liveNip05, username: liveUsername, loading: nip05Loading } = useNip05Lookup();
    const resetOnboarding = useOnboardingStore(state => state.resetOnboarding);

    const [seedWords, setSeedWords] = useState<string[]>([]);
    const [isSeedVisible, setIsSeedVisible] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const handleSettingPress = async (id: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        switch (id) {
            case 'backup':
                const success = await biometricService.authenticateAsync('Authorize to view your secret backup phrase');
                if (success) {
                    router.push('/backup-seed');
                } else {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                }
                break;
            case 'export':
                handleExportWallet();
                break;
            case 'biometric':
                biometricSheetRef.current?.present();
                break;
            case 'theme':
                themeSheetRef.current?.present();
                break;
            case 'currency':
                currencySheetRef.current?.present();
                break;
            case 'mint':
                mintSheetRef.current?.present();
                break;
            case 'notifications':
                notificationsSheetRef.current?.present();
                break;
            case 'nostr':
                router.push('/(modals)/nostr-settings');
                break;
            case 'nostr-username':
                router.push('/(modals)/nostr-username');
                break;
            default:
                break;
        }
    };

    const handleExportWallet = async () => {
        const authed = await biometricService.authenticateAsync('Authenticate to export your wallet backup');
        if (!authed) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }
        setIsExporting(true);
        try {
            const mnemonic = await seedService.getMnemonic();
            if (!mnemonic) throw new Error('No mnemonic found.');

            const { backupService } = require('~/services/backupService');
            const state = await backupService.exportState();
            const { theme } = useSettingsStore.getState();

            await walletFileService.exportWallet(mnemonic, {
                mints: state.mints,
                keysets: state.keysets,
                proofs: state.proofs,
                counters: state.counters,
                history: state.history,
                mintQuotes: state.mintQuotes,
                defaultMintUrl,
                secondaryCurrency,
                theme,
            });
        } catch (err: any) {
            console.error('[Settings] Export failed:', err);
            Alert.alert('Export Failed', err?.message ?? 'Could not export wallet.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleDeleteWallet = async () => {
        const authed = await biometricService.authenticateAsync('Authenticate to delete your wallet');
        if (!authed) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        try {
            const mnemonic = await seedService.getMnemonic();
            if (mnemonic) {
                setSeedWords(mnemonic.split(' '));
            } else {
                setSeedWords([]);
            }
            setIsSeedVisible(false);
            deleteSheetRef.current?.present();
        } catch (err) {
            console.error('[Settings] Failed to fetch seed:', err);
            Alert.alert('Error', 'Could not retrieve recovery phrase.');
        }
    };

    const executeWalletDeletion = async () => {
        setIsDeleting(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        try {
            await initService.destroyWallet();
            await resetOnboarding();
            deleteSheetRef.current?.dismiss();

            if (__DEV__ && DevSettings?.reload) {
                DevSettings.reload();
            } else {
                Alert.alert('Wallet Deleted', 'Please restart the app to complete the reset.');
            }
        } catch (err: any) {
            console.error('[Settings] Delete failed:', err);
            Alert.alert('Error', `Failed to delete wallet: ${err.message}`);
        } finally {
            setIsDeleting(false);
        }
    };

    const SETTINGS_CONFIG: SettingSectionConfig[] = [
        {
            title: 'Security',
            items: [
                {
                    id: 'biometric',
                    title: 'Biometric Lock',
                    value: biometricEnabled ? 'Enabled' : 'Disabled',
                    icon: Fingerprint,
                    color: '$blue10',
                },
                {
                    id: 'backup',
                    title: 'Backup Recovery Phrase',
                    icon: ShieldCheck,
                    color: '$blue10',
                },
                {
                    id: 'export',
                    title: 'Export Wallet File',
                    icon: isExporting ? ActivityIndicator : Download,
                    disabled: isExporting,
                    color: '$blue10',
                },
            ],
        },
        {
            title: 'Appearance',
            items: [
                {
                    id: 'theme',
                    title: 'Theme',
                    value: theme.charAt(0).toUpperCase() + theme.slice(1),
                    icon: Palette,
                    color: '$blue10',
                },
                {
                    id: 'currency',
                    title: 'Currency',
                    value: secondaryCurrency,
                    icon: undefined,
                    color: '$blue10',
                },
            ],
        },
        {
            title: 'General',
            items: [
                {
                    id: 'mint',
                    title: 'Default Mint',
                    value: defaultMintUrl ? new URL(defaultMintUrl).hostname : 'None',
                    icon: Server,
                    color: '$blue10',
                },
                {
                    id: 'notifications',
                    title: 'Notifications',
                    icon: Bell,
                    color: '$blue10',
                },
                {
                    id: 'language',
                    title: 'Language',
                    value: 'System',
                    icon: Globe,
                    color: '$blue10',
                    opacity: 0.5,
                },
            ],
        },
        {
            title: 'Nostr',
            items: [
                {
                    id: 'nostr',
                    title: 'Nostr Settings',
                    icon: NostrIcon,
                    color: '$purple10',
                },
                {
                    id: 'nostr-username',
                    title: 'Nostr Username',
                    value: liveNip05 ? liveNip05.split('@')[0] : (nip05Loading ? 'Looking up…' : 'Claim Free'),
                    icon: AtSign,
                    color: '$blue10',
                },
            ],
        },
        {
            title: 'About',
            items: [
                {
                    id: 'update',
                    title: 'Check for Updates',
                    icon: RefreshCw,
                    color: '$gray10',
                    onPress: async () => {
                        try {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            if (__DEV__) {
                                Alert.alert('Development Mode', 'Updates are not supported in development mode.');
                                return;
                            }
                            const { isAvailable } = await Updates.checkForUpdateAsync();
                            if (isAvailable) {
                                router.push('/(modals)/ota-update');
                            } else {
                                Alert.alert('Up to Date', 'You are already on the latest version of Bey Wallet.');
                            }
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to check for updates.');
                        }
                    }
                },
                {
                    id: 'about',
                    title: 'Version',
                    value: APP_VERSION,
                    icon: Info,
                    color: '$gray10',
                    pressStyle: { bg: '$gray3' },
                    onPress: () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push('/(modals)/about');
                    }
                },
            ],
        },
        {
            title: 'Danger Zone',
            titleColor: '$red10',
            bg: '$red3',
            items: [
                {
                    id: 'delete',
                    title: 'Delete Wallet',
                    icon: Trash2,
                    color: '$red10',
                    hoverStyle: { bg: '$red4' },
                    pressStyle: { bg: '$red5' },
                    onPress: handleDeleteWallet,
                },
            ],
        },
    ];

    return (
        <ScrollView bg="$background" showsVerticalScrollIndicator={false}>
            <YStack flex={1} p="$4" gap="$3" pb="$20">
                {SETTINGS_CONFIG.map((section) => (
                    <SettingSection
                        key={section.title}
                        {...section}
                        onItemPress={handleSettingPress}
                    />
                ))}

                <ThemeModal ref={themeSheetRef} />
                <CurrencyModal ref={currencySheetRef} />
                <MintModal ref={mintSheetRef} />
                <NotificationsModal ref={notificationsSheetRef} />
                <BiometricModal ref={biometricSheetRef} />

                <DeleteWalletSheet
                    innerRef={deleteSheetRef}
                    isDeleting={isDeleting}
                    seedWords={seedWords}
                    isSeedVisible={isSeedVisible}
                    onToggleSeedVisibility={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setIsSeedVisible(!isSeedVisible);
                    }}
                    onDelete={executeWalletDeletion}
                    onCancel={() => deleteSheetRef.current?.dismiss()}
                />
            </YStack>
        </ScrollView>
    );
}
