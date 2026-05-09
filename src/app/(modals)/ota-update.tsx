import React, { useState, useEffect } from 'react';
import { YStack, Text, Button, Spinner, useTheme } from 'tamagui';
import * as Updates from 'expo-updates';
import { DownloadCloud, CheckCircle, AlertCircle } from '@tamagui/lucide-icons';

export default function OtaUpdateScreen() {
    const [status, setStatus] = useState<'downloading' | 'ready' | 'error'>('downloading');
    const [errorMsg, setErrorMsg] = useState('');
    const theme = useTheme();

    useEffect(() => {
        downloadUpdate();
    }, []);

    const downloadUpdate = async () => {
        try {
            setStatus('downloading');
            // Check if we are in an environment that supports updates (not dev client)
            if (__DEV__) {
                // Mock behavior for dev client where Updates.fetchUpdateAsync throws
                setTimeout(() => setStatus('ready'), 2000);
                return;
            }
            await Updates.fetchUpdateAsync();
            setStatus('ready');
        } catch (error: any) {
            setStatus('error');
            setErrorMsg(error.message || 'Failed to download update.');
        }
    };

    const handleRestart = async () => {
        if (__DEV__) {
            console.log('Would reload app here in production');
            return;
        }
        await Updates.reloadAsync();
    };

    return (
        <YStack flex={1} padding="$4" justifyContent="center" alignItems="center" space="$6">
            {status === 'downloading' && (
                <>
                    <DownloadCloud size={64} color={theme.color11?.val} />
                    <Text fontSize={24} fontWeight="bold">Downloading Update...</Text>
                    <Text fontSize={16} color="$color11" textAlign="center">
                        Please wait while we download the latest features and fixes.
                    </Text>
                    <Spinner size="large" color="$color" />
                </>
            )}

            {status === 'ready' && (
                <>
                    <CheckCircle size={64} color="$green10" />
                    <Text fontSize={24} fontWeight="bold">Update Ready!</Text>
                    <Text fontSize={16} color="$color11" textAlign="center">
                        The update has been downloaded successfully. Restart the app to apply it.
                    </Text>
                    <Button size="$5" theme="active" onPress={handleRestart} width="100%" marginTop="$4">
                        Restart App
                    </Button>
                </>
            )}

            {status === 'error' && (
                <>
                    <AlertCircle size={64} color="$red10" />
                    <Text fontSize={24} fontWeight="bold" color="$red10">Update Failed</Text>
                    <Text fontSize={16} color="$color11" textAlign="center">
                        {errorMsg}
                    </Text>
                    <Button size="$4" onPress={downloadUpdate} width="100%" marginTop="$4">
                        Try Again
                    </Button>
                </>
            )}
        </YStack>
    );
}
