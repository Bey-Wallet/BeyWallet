import React, { useRef, useState } from 'react';
import { YStack, ScrollView } from 'tamagui';
import { ShieldCheck, Palette, Bell, Globe, Info, Trash2, Download, Server, AtSign, RefreshCw } from '@tamagui/lucide-icons';
import { ThemeModal } from './components/ThemeModal';
import { CurrencyModal } from './components/CurrencyModal';
import { NotificationsModal } from './components/NotificationsModal';
import { MintModal } from './components/MintModal';
import { SettingSection } from './components/SettingSection';
import { DeleteWalletSheet } from './components/DeleteWalletSheet';
import { SettingSectionConfig } from './components/types';
import NostrIcon from '~/components/icons/NostrIcon';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '~/store/settingsStore';
import { useRouter } from 'expo-router';
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
    const deleteSheetRef = useRef<AppBottomSheetRef>(null);

    const { secondaryCurrency, defaultMintUrl } = useSettingsStore();
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
                    id: 'backup',
                    title: 'Backup Recovery Phrase',
                    subTitle: 'View your secret 12 words',
                    icon: ShieldCheck,
                },
                {
                    id: 'export',
                    title: 'Export Wallet File',
                    subTitle: isExporting ? 'Preparing backup...' : 'Save a .bey backup to your device',
                    icon: isExporting ? ActivityIndicator : Download,
                    disabled: isExporting,
                },
            ],
        },
        {
            title: 'Appearance',
            items: [
                {
                    id: 'theme',
                    title: 'Theme',
                    subTitle: 'Light, Dark or System',
                    icon: Palette,
                },
                {
                    id: 'currency',
                    title: 'Currency',
                    subTitle: `Secondary: ${secondaryCurrency}`,
                    icon: Globe,
                },
            ],
        },
        {
            title: 'General',
            items: [
                {
                    id: 'mint',
                    title: 'Default Mint',
                    subTitle: defaultMintUrl ? new URL(defaultMintUrl).hostname : 'None selected',
                    icon: Server,
                },
                {
                    id: 'notifications',
                    title: 'Notifications',
                    subTitle: 'Manage alerts and updates',
                    icon: Bell,
                },
                {
                    id: 'language',
                    title: 'Language',
                    subTitle: 'English (US)',
                    icon: Globe,
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
                    subTitle: 'Manage your npub, nsec, and relays',
                    icon: NostrIcon,
                },
                {
                    id: 'nostr-username',
                    title: 'Nostr Username',
                    subTitle: liveNip05 ? liveNip05 : (nip05Loading ? 'Looking up…' : 'Claim a free NIP-05 address'),
                    icon: AtSign,
                },
            ],
        },
        {
            title: 'About',
            items: [
                {
                    id: 'update',
                    title: 'Check for Updates',
                    subTitle: 'Verify if a new version is available',
                    icon: RefreshCw,
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
                    subTitle: `${APP_VERSION}`,
                    icon: Info,
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
                    subTitle: 'Permanently erase all wallet data',
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
            <YStack flex={1} p="$4" gap="$6" pb="$20">
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
