import React, { useRef, useState } from 'react';
import { YStack, ScrollView, Text } from 'tamagui';
import { ShieldCheck, Fingerprint, Palette, Bell, Globe, Info, Trash2, Download, Server, AtSign, RefreshCw, Zap, ArrowUpFromLine, Sparkles } from '@tamagui/lucide-icons';
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
import { consolidationService } from '~/services/core';
import { proofService } from '~/services/core';
import { useOnboardingStore } from '~/store/onboardingStore';
import { AppBottomSheetRef } from '~/components/UI/AppBottomSheet';
import { ActivityIndicator, Alert, DevSettings, Linking } from 'react-native';
import { walletFileService } from '~/services/walletFileService';
import Constants from 'expo-constants';
import { useNip05Lookup } from '~/hooks/useNip05Lookup';
import * as Updates from 'expo-updates';
import { useWalletStore } from '~/store/walletStore';
import { InfoSheet, InfoSheetRef } from '~/components/UI/InfoSheet';
import * as Application from 'expo-application';
import BeyIcon from '~/components/icons/BeyIcon';

const appVersion = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '0.1.0';
const buildVersion = Application.nativeBuildVersion ?? 
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode?.toString() ??
    '1';

export function SettingsScreen() {
    const router = useRouter();
    const themeSheetRef = useRef<AppBottomSheetRef>(null);
    const currencySheetRef = useRef<AppBottomSheetRef>(null);
    const mintSheetRef = useRef<AppBottomSheetRef>(null);
    const notificationsSheetRef = useRef<AppBottomSheetRef>(null);
    const biometricSheetRef = useRef<AppBottomSheetRef>(null);
    const deleteSheetRef = useRef<AppBottomSheetRef>(null);
    const infoSheetRef = useRef<InfoSheetRef>(null);

    const { theme, secondaryCurrency, defaultMintUrl, biometricEnabled, showBitcoinSymbol, setShowBitcoinSymbol, primaryCurrency, setPrimaryCurrency } = useSettingsStore();
    const { activeMintUrl, refreshBalance } = useWalletStore();
    const { nip05: liveNip05, username: liveUsername, loading: nip05Loading } = useNip05Lookup();
    const resetOnboarding = useOnboardingStore(state => state.resetOnboarding);

    const [seedWords, setSeedWords] = useState<string[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isVerifyingDleq, setIsVerifyingDleq] = useState(false);
    const [updateStatus, setUpdateStatus] = useState<'checking' | 'available' | 'none'>('checking');

    React.useEffect(() => {
        if (__DEV__) {
            setUpdateStatus('none');
            return;
        }
        Updates.checkForUpdateAsync().then(({ isAvailable }) => {
            setUpdateStatus(isAvailable ? 'available' : 'none');
        }).catch((err) => {
            console.warn('[SettingsScreen] Failed to check for updates on mount:', err);
            setUpdateStatus('none');
        });
    }, []);

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
            case 'import':
                handleImportWalletBackup();
                break;
            case 'consolidate':
                router.push('/(modals)/optimize-wallet');
                break;
            case 'verify-dleq':
                handleVerifyDleq();
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

    const handleVerifyDleq = async () => {
        if (!activeMintUrl) {
            infoSheetRef.current?.present({
                title: 'No Active Mint',
                description: 'Select a mint to verify proofs for.',
                type: 'warning',
            });
            return;
        }
        setIsVerifyingDleq(true);
        try {
            const results = await proofService.verifyDleqProofs(activeMintUrl);
            if (results.length === 0) {
                infoSheetRef.current?.present({
                    title: 'No DLEQ Data',
                    description: 'None of your stored proofs have DLEQ data. This is normal for older proofs or mints that do not provide DLEQ.',
                    type: 'info',
                });
                return;
            }
            const validCount = results.filter(r => r.valid).length;
            const invalidResults = results.filter(r => !r.valid);
            if (invalidResults.length === 0) {
                infoSheetRef.current?.present({
                    title: 'All Proofs Valid',
                    description: `${validCount}/${results.length} proofs verified offline.\nThe mint signed all proofs honestly.`,
                    type: 'success',
                });
            } else {
                const failedAmounts = invalidResults.map(r => `${r.amount} sats`).join(', ');
                infoSheetRef.current?.present({
                    title: 'DLEQ Verification Failed',
                    description: `${validCount}/${results.length} proofs valid.\n\nFailed amounts: ${failedAmounts}\n\nConsider consolidating your wallet or contacting the mint operator.`,
                    type: 'error',
                });
            }
        } catch (err: any) {
            infoSheetRef.current?.present({
                title: 'Verification Failed',
                description: err.message || 'Could not verify proofs.',
                type: 'error',
            });
        } finally {
            setIsVerifyingDleq(false);
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

            const fileName = await walletFileService.exportWallet(mnemonic, {
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

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            infoSheetRef.current?.present({
                title: 'Backup Exported',
                description: `Your wallet data has been exported successfully.\n\nFilename: ${fileName}`,
                type: 'success',
            });
        } catch (err: any) {
            console.error('[Settings] Export failed:', err);
            infoSheetRef.current?.present({
                title: 'Export Failed',
                description: err?.message ?? 'Could not export wallet.',
                type: 'error',
            });
        } finally {
            setIsExporting(false);
        }
     };

     const handleImportWalletBackup = async () => {
         const authed = await biometricService.authenticateAsync('Authenticate to import wallet backup');
         if (!authed) {
             Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
             return;
         }

         Alert.alert(
             'Confirm Restore',
             'This will replace your current wallet data with the backup. This cannot be undone. Are you sure you want to proceed?',
             [
                 { text: 'Cancel', style: 'cancel' },
                 {
                     text: 'Restore',
                     style: 'destructive',
                     onPress: async () => {
                         setIsDeleting(true);
                         try {
                             const backup = await walletFileService.importWalletFromFile();
                             
                             // 1. Destroy current database
                             await initService.destroyWallet();

                             // 2. Re-create wallet seed
                             await initService.restoreWallet(backup.mnemonic, { quiet: true });

                             // 3. Import full DB state
                             const backupState = {
                                 mints: backup.mints,
                                 keysets: backup.keysets,
                                 proofs: backup.proofs,
                                 counters: backup.counters,
                                 history: backup.history,
                                 mintQuotes: backup.mintQuotes,
                             };
                             const { backupService } = require('~/services/backupService');
                             await backupService.importState(backupState);

                             // 4. Re-init fast
                             await initService.reinitFast();

                             // 5. Restore settings
                             const settingsStore = useSettingsStore.getState();
                             if (backup.secondaryCurrency) await settingsStore.setSecondaryCurrency(backup.secondaryCurrency);
                             if (backup.theme) await settingsStore.setTheme(backup.theme);
                             if (backup.defaultMintUrl) await settingsStore.setDefaultMintUrl(backup.defaultMintUrl);

                             Alert.alert('Restore Completed', 'Your wallet has been restored successfully. Please restart the app.', [
                                 {
                                     text: 'OK',
                                     onPress: () => {
                                         if (__DEV__ && DevSettings?.reload) {
                                             DevSettings.reload();
                                         }
                                     }
                                 }
                             ]);
                         } catch (err: any) {
                             if (err?.message !== 'File selection was cancelled.') {
                                 console.error('[Settings] Restore failed:', err);
                                 Alert.alert('Restore Failed', err?.message ?? 'Could not import backup.');
                             }
                         } finally {
                             setIsDeleting(false);
                         }
                     }
                 }
             ]
         );
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
                 
                },
                {
                    id: 'backup',
                    title: 'Backup Recovery Phrase',
                    icon: ShieldCheck,
                 
                },
                {
                    id: 'export',
                    title: 'Export wallet data',
                    subTitle: 'Download a dump of your wallet. You can restore your wallet from this file in the welcome screen of a new wallet. This file will be out of sync if you keep using your wallet after exporting it.',
                    icon: isExporting ? ActivityIndicator : ArrowUpFromLine,
                    disabled: isExporting,
                 
                },
                {
                    id: 'import',
                    title: 'Import wallet backup',
                    subTitle: 'Restore your wallet from a previously exported backup file. This will replace your current wallet data with the backup.',
                    icon: Download,
                 
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
                 
                },
                {
                    id: 'primary-currency',
                    title: 'Primary Display Unit',
                    value: primaryCurrency,
                    icon: undefined,
                    onPress: () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setPrimaryCurrency(primaryCurrency === 'SATS' ? 'FIAT' : 'SATS');
                    }
                },
                {
                    id: 'currency',
                    title: 'Secondary Currency',
                    value: secondaryCurrency === 'NONE' ? 'None' : secondaryCurrency,
                    icon: undefined,
                },
                {
                    id: 'showBitcoinSymbol',
                    title: 'Use ₿ Symbol as Sats',
                    icon: undefined,
                 
                    isSwitch: true,
                    checked: showBitcoinSymbol,
                    onCheckedChange: (val) => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowBitcoinSymbol(val);
                    }
                },
            ],
        },
        {
            title: 'General',
            items: [
                {
                    id: 'mint',
                    title: 'Fallback Mint',
                    value: defaultMintUrl ? (() => { try { return new URL(defaultMintUrl).hostname; } catch { return defaultMintUrl; } })() : 'None',
                    icon: Server,
                  
                },
                {
                    id: 'notifications',
                    title: 'Notifications',
                    icon: Bell,
                  
                },
                {
                    id: 'consolidate',
                    title: 'Optimize Wallet',
              
                    icon: Sparkles,
                
                },
                {
                    id: 'verify-dleq',
                    title: 'Verify Proofs (Offline)',
                    subtitle: isVerifyingDleq ? 'Verifying…' : 'Cryptographic offline proof check',
                    icon: isVerifyingDleq ? ActivityIndicator : ShieldCheck,
                    disabled: isVerifyingDleq,
                  
                },
                {
                    id: 'update',
                    title: 'Update Manager',
                    value: updateStatus === 'available' ? '1 update' : undefined,
                    icon: RefreshCw,
                    onPress: () => {
                        router.push('/(modals)/ota-update');
                    }
                },
                {
                    id: 'language',
                    title: 'Language',
                    value: 'System',
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
                    icon: NostrIcon,
                    color: '$purple10',
                },
                {
                    id: 'nostr-username',
                    title: 'Nostr Username',
                    value: liveNip05 ? liveNip05.split('@')[0] : (nip05Loading ? 'Looking up…' : 'Claim Free'),
                    icon: AtSign,
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
                    onDelete={executeWalletDeletion}
                    onCancel={() => deleteSheetRef.current?.dismiss()}
                />

                <InfoSheet ref={infoSheetRef} />

                {/* About App Info Footer (Tonkeeper-style) */}
                <YStack items="center" justify="center" gap="$2.5" mt="$8" mb="$4">
                    <YStack
                        width={64}
                        height={64}
                        rounded="$4"
                        bg="transparent"
                        items="center"
                        justify="center"
                    >
                        <BeyIcon size={64} color="$color" />
                    </YStack>
                    <YStack items="center" gap="$1">
                        <Text fontWeight="700" fontSize="$5" color="$color">
                            Bey Wallet
                        </Text>
                        <Text fontSize="$3" color="$gray10" fontWeight="500">
                            Version {appVersion}{buildVersion ? ` (${buildVersion})` : ''}
                        </Text>
                        <Text
                            fontSize="$3"
                            color="$blue10"
                            fontWeight="600"
                            pressStyle={{ opacity: 0.7 }}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                Linking.openURL('https://github.com/Bey-Wallet/BeyWallet');
                            }}
                        >
                            GitHub
                        </Text>
                    </YStack>
                </YStack>
            </YStack>
        </ScrollView>
    );
}
