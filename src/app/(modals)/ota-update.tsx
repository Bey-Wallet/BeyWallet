import React, { useState, useEffect } from 'react';
import { YStack, XStack, Text, Button, Spinner, useTheme, View } from 'tamagui';
import * as Updates from 'expo-updates';
import { DownloadCloud, CheckCircle, AlertCircle, RefreshCw, Smartphone, Award, Sparkles } from '@tamagui/lucide-icons';
import { SafeFlex } from '~/components/UI/Flex';
import { ListTable, ListTableRow } from '~/components/UI/ListTable';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import BeyIcon from '~/components/icons/BeyIcon';
import * as Haptics from 'expo-haptics';

const appVersion = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '0.2.0';
const buildVersion = Application.nativeBuildVersion ?? 
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode?.toString() ??
    '1';

export default function OtaUpdateScreen() {
    const [status, setStatus] = useState<'idle' | 'checking' | 'no-update' | 'update-available' | 'downloading' | 'ready' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [newManifest, setNewManifest] = useState<any>(null);
    const theme = useTheme();

    const handleCheckUpdates = async () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setStatus('checking');

            const check = await Updates.checkForUpdateAsync();
            if (check.isAvailable) {
                setNewManifest(check.manifest);
                setStatus('update-available');
            } else {
                setStatus('no-update');
            }
        } catch (error: any) {
            setStatus('error');
            setErrorMsg(error.message || 'Failed to check for updates.');
        }
    };

    const handleDownload = async () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setStatus('downloading');

            await Updates.fetchUpdateAsync();
            setStatus('ready');
        } catch (error: any) {
            setStatus('error');
            setErrorMsg(error.message || 'Failed to fetch update.');
        }
    };

    const handleRestart = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await Updates.reloadAsync();
    };

    const whatsNewItems = React.useMemo(() => {
        if (!newManifest) return [];
        const message = newManifest.message || 
                        newManifest.extra?.expoClient?.extra?.updatesMessage || 
                        newManifest.metadata?.message || 
                        newManifest.extra?.message || 
                        newManifest.extra?.expoClient?.updates?.message ||
                        '';
        
        try {
            if (message) {
                if (message.startsWith('{') || message.startsWith('[')) {
                    const parsed = JSON.parse(message);
                    if (Array.isArray(parsed)) return parsed;
                    if (parsed.whatsNew) return Array.isArray(parsed.whatsNew) ? parsed.whatsNew : [parsed.whatsNew];
                    if (parsed.message) return [parsed.message];
                }
                return message.split(/[;\n]/).map((s: string) => s.trim()).filter(Boolean);
            }
        } catch (e) {
            return [message];
        }
        return ['Bug fixes and performance improvements.'];
    }, [newManifest]);

    // Format new version if available in manifest
    const newVersionString = React.useMemo(() => {
        if (!newManifest) return '';
        const version = newManifest.metadata?.version || newManifest.extra?.expoClient?.version || '';
        return version ? `v${version}` : '';
    }, [newManifest]);

    return (
        <SafeFlex fill bg="$background" px="$4">
            <YStack flex={1} justify="space-between" py="$4">
                <YStack gap="$6" flex={1} justify="center" items="center" width="100%">
                    
                    {/* App Logo & Name */}
                    <YStack items="center" gap="$2" >
                        
                            <BeyIcon size={64} color="$color" />
                       
                        <Text fontSize={28} fontWeight="900" color="$color">Bey Wallet</Text>
                        <Text fontSize="$3" color="$gray10" fontWeight="600">
                            Current Version: v{appVersion} ({buildVersion})
                        </Text>
                    </YStack>

                    {/* Status Sections */}
                    {status === 'idle' && (
                        <YStack items="center" gap="$2" width="100%">
                            <Text fontSize="$4" color="$gray10" fontWeight="600" textAlign="center">
                                Tap check to scan for updates.
                            </Text>
                        </YStack>
                    )}

                    {status === 'checking' && (
                        <YStack items="center" gap="$4" width="100%">
                            <Spinner size="large" color="$accent10" />
                            <Text fontSize="$4" color="$gray10" fontWeight="600" textAlign="center">
                                Checking for updates...
                            </Text>
                        </YStack>
                    )}

                    {status === 'no-update' && (
                        <YStack items="center" gap="$3" width="100%">
                            <CheckCircle size={48} color="$green10" strokeWidth={2.5} />
                            <Text fontSize={20} fontWeight="800" color="$color">Up to Date</Text>
                            <Text fontSize="$3" color="$gray10" fontWeight="600" textAlign="center">
                                No updates available. You are running the latest version.
                            </Text>
                        </YStack>
                    )}

                    {status === 'update-available' && (
                        <YStack gap="$4"  width="100%">
                            <XStack gap="$2.5" items="center" self="center" bg="$blue10" px="$3.5" py="$3" rounded="$10">
                                <Sparkles size={16} color="$white" />
                                <Text fontSize="$3" fontWeight="800" color="$white">
                                    Update Available! {newVersionString}
                                </Text>
                            </XStack>

                            <Text fontSize="$2" fontWeight="800" color="$gray10" textTransform="uppercase" px="$1">
                                What's New
                            </Text>

                            <ListTable width="100%">
                                {whatsNewItems.map((item, idx) => (
                                    <ListTableRow
                                        key={idx}
                                        label={item}
                                        icon={Sparkles}
                                        iconColor="$accent10"
                                    />
                                ))}
                            </ListTable>
                        </YStack>
                    )}

                    {status === 'downloading' && (
                        <YStack items="center" gap="$4" width="100%">
                            <Spinner size="large" color="$accent10" />
                            <Text fontSize={20} fontWeight="800" color="$color">Downloading Update...</Text>
                            <Text fontSize="$3" color="$gray10" fontWeight="600" textAlign="center">
                                Downloading the latest release. Please do not close the app.
                            </Text>
                        </YStack>
                    )}

                    {status === 'ready' && (
                        <YStack items="center" gap="$3" width="100%">
                            <CheckCircle size={48} color="$green10" strokeWidth={2.5} />
                            <Text fontSize={20} fontWeight="800" color="$color">Update Ready</Text>
                            <Text fontSize="$3" color="$gray10" fontWeight="600" textAlign="center">
                                Restart the app to apply the downloaded update.
                            </Text>
                        </YStack>
                    )}

                    {status === 'error' && (
                        <YStack items="center" gap="$3" width="100%">
                            <AlertCircle size={48} color="$red10" strokeWidth={2.5} />
                            <Text fontSize={20} fontWeight="800" color="$red10">Check Failed</Text>
                            <Text fontSize="$3" color="$gray10" fontWeight="600" textAlign="center">
                                {errorMsg}
                            </Text>
                        </YStack>
                    )}

                </YStack>

                {/* Bottom Action Button Stack */}
                <YStack gap="$2" width="100%">
                    {(status === 'idle' || status === 'no-update' || status === 'error') && (
                        <Button
                            theme="accent"
                            size="$5"
                            height={55}
                            rounded="$5"
                            fontWeight="800"
                            onPress={handleCheckUpdates}
                            disabled={status === 'checking'}
                        >
                            Check for Updates
                        </Button>
                    )}

                    {status === 'update-available' && (
                        <Button
                            theme="accent"
                            size="$5"
                            height={55}
                            rounded="$5"
                            fontWeight="800"
                            onPress={handleDownload}
                        >
                            Download & Install
                        </Button>
                    )}

                    {status === 'ready' && (
                        <Button
                            theme="accent"
                            size="$5"
                            height={55}
                            rounded="$5"
                            fontWeight="800"
                            onPress={handleRestart}
                        >
                            Restart App
                        </Button>
                    )}
                </YStack>
            </YStack>
        </SafeFlex>
    );
}
