import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { URDecoder } from '@gandlaf21/bc-ur';
import { YStack, XStack, Text, Button, View, ZStack, Spinner, Theme } from 'tamagui';
import { X, Zap, ZapOff, RefreshCcw } from '@tamagui/lucide-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '~/store/authStore';
import { useWalletStore } from '~/store/walletStore';
import * as Clipboard from 'expo-clipboard';
import { Clipboard as ClipboardIcon } from '@tamagui/lucide-icons';

const { width, height } = Dimensions.get('window');
const SCAN_AREA_SIZE = width * 0.7;

export default function ScannerScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [flash, setFlash] = useState<'off' | 'on'>('off');
    const [progress, setProgress] = useState(0);
    const [isUR, setIsUR] = useState(false);
    const decoderRef = useRef<URDecoder>(new URDecoder());

    const { setLockDisabled } = useAuthStore();

    useEffect(() => {
        if (!permission) {
            // Prevent auto-lock from triggering when the native permission 
            // prompt pushes the app into the background state.
            setLockDisabled(true);
            requestPermission().finally(() => {
                // Short delay to allow AppState to settle back to 'active'
                setTimeout(() => setLockDisabled(false), 1000);
            });
        }
    }, [permission]);

    if (!permission) {
        return (
            <YStack flex={1} bg="black" items="center" justify="center">
                <Spinner size="large" color="white" />
            </YStack>
        );
    }

    if (!permission.granted) {
        return (
            <YStack flex={1} bg="black" items="center" justify="center" p="$4" gap="$4">
                <Text color="white" fontSize="$6" fontWeight="700" style={{ textAlign: 'center' }}>
                    Camera Permission Required
                </Text>
                <Text color="$gray10" style={{ textAlign: 'center' }}>
                    We need your permission to show the camera to scan QR codes.
                </Text>
                <Button theme="accent" onPress={requestPermission}>
                    Grant Permission
                </Button>
                <Button chromeless color="white" onPress={() => router.back()}>
                    Cancel
                </Button>
            </YStack>
        );
    }

    const handleBarcodeScanned = (result: BarcodeScanningResult) => {
        if (scanned) return;

        const data = result.data.trim();

        // Handle UR (Multipart QR)
        if (data.toLowerCase().startsWith('ur:')) {
            setIsUR(true);
            try {
                decoderRef.current.receivePart(data);
                const p = decoderRef.current.estimatedPercentComplete();
                setProgress(p);

                if (decoderRef.current.isComplete()) {
                    if (decoderRef.current.isSuccess()) {
                        const ur = decoderRef.current.resultUR();
                        // Robust string conversion for decoded UR payload
                        let decodedStr = '';
                        try {
                            const decoded = ur.decodeCBOR();
                            if (typeof decoded === 'string') {
                                decodedStr = decoded;
                            } else if (Buffer.isBuffer(decoded)) {
                                decodedStr = decoded.toString('utf8');
                            } else if ((decoded as any) instanceof Uint8Array || Array.isArray(decoded)) {
                                decodedStr = Buffer.from(decoded as any).toString('utf8');
                            } else {
                                decodedStr = String(decoded);
                            }
                        } catch (e) {
                            // Fallback: the sender may have passed a raw string Buffer instead of CBOR
                            if (ur.cbor) {
                                decodedStr = ur.cbor.toString('utf8');
                            }
                        }

                        onSuccess(decodedStr);
                    } else {
                        // Reset if failed
                        decoderRef.current = new URDecoder();
                        setProgress(0);
                    }
                }
            } catch (e) {
                console.error('UR Decoding error:', e);
                decoderRef.current = new URDecoder();
                setProgress(0);
            }
        } else {
            // Static QR
            onSuccess(data);
        }
    };

    const onSuccess = (data: string) => {
        setScanned(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        const trimmed = data.trim();
        const lower = trimmed.toLowerCase();

        const isCashuToken = lower.startsWith('cashub') || lower.startsWith('cashua');
        const isPaymentRequest = lower.startsWith('creqa') || lower.startsWith('creqb');
        const isCashu = isCashuToken || isPaymentRequest || lower.includes('cashu') || lower.includes('creq');

        // If explicitly asked to return to a path (e.g. from P2PK Send flow)
        // We PRIORITIZE this because the user is already in a specific flow.
        if (params.returnTo) {
            console.log('[Scanner] returnTo detected:', params.returnTo);

            // Special case: if we want to go TO receive flow, redirect there with token
            if (params.returnTo === '/receive' || params.returnTo === '/(modals)/receive') {
                router.replace({
                    pathname: '/(modals)/receive',
                    params: { scannedToken: trimmed }
                });
                return;
            }

            console.log('[Scanner] Returning result to store for:', params.returnTo);
            useWalletStore.getState().setScannerResult(trimmed);
            router.back();
            return;
        }

        // ── NUT-18 Payment Request ────────────────────────────────────────
        // Route to the Send modal which has a PaymentRequestStage
        if (isPaymentRequest) {
            console.log('[Scanner] NUT-18 payment request detected, routing to send...');
            router.replace({
                pathname: '/(modals)/send',
                params: { paymentRequest: trimmed }
            });
            return;
        }

        // ── Cashu Token ───────────────────────────────────────────────────
        if (isCashuToken) {
            console.log('[Scanner] Cashu token detected, redirecting to receive...');
            router.replace({
                pathname: '/(modals)/receive',
                params: { scannedToken: trimmed }
            });
            return;
        }

        // Fallback: Set result in store and go back
        console.log('[Scanner] Non-cashu data, returning to previous screen...');
        useWalletStore.getState().setScannerResult(trimmed);
        router.back();
    };


    const handlePaste = async () => {
        const text = await Clipboard.getStringAsync();
        if (text) {
            onSuccess(text);
        }
    };

    return (
        <Theme name="dark">
            <ZStack flex={1} bg="black">
                <CameraView
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    enableTorch={flash === 'on'}
                    onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                    barcodeScannerSettings={{
                        barcodeTypes: ['qr'],
                    }}
                />

                {/* Overlay UI */}
                <SafeAreaView style={{ flex: 1 }}>
                    <YStack flex={1} justify="space-between" p="$4">
                        {/* Header */}
                        <XStack justify="space-between" items="center">
                            <Button
                                circular
                                size="$4"
                                bg="rgba(0,0,0,0.5)"
                                icon={<X size={24} color="white" />}
                                onPress={() => router.back()}
                            />
                            <XStack gap="$2">
                                <Button
                                    circular
                                    size="$4"
                                    bg="rgba(0,0,0,0.5)"
                                    icon={<ClipboardIcon size={20} color="white" />}
                                    onPress={handlePaste}
                                />
                                <Button
                                    circular
                                    size="$4"
                                    bg="rgba(0,0,0,0.5)"
                                    icon={flash === 'on' ? <Zap size={24} color="#FFD700" /> : <ZapOff size={24} color="white" />}
                                    onPress={() => setFlash(f => f === 'on' ? 'off' : 'on')}
                                />
                            </XStack>
                        </XStack>

                        {/* Middle - Scan Frame */}
                        <YStack items="center">
                            <View
                                width={SCAN_AREA_SIZE}
                                height={SCAN_AREA_SIZE}
                                borderWidth={2}
                                borderColor="white"
                                rounded="$6"
                                style={{
                                    borderStyle: 'dashed',
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                }}
                            />
                            <Text color="white" mt="$4" fontWeight="600" style={{ textAlign: 'center', textShadowColor: 'black', textShadowRadius: 2 }}>
                                {isUR ? 'Scanning animated QR...' : 'Align QR code within the frame'}
                            </Text>
                        </YStack>

                        {/* Footer - Progress */}
                        <YStack gap="$4" items="center" pb="$8">
                            {progress > 0 && (
                                <YStack width="80%" gap="$2">
                                    <XStack justify="space-between">
                                        <Text color="white" fontWeight="700">Reading Fragments...</Text>
                                        <Text color="white" fontWeight="700">{Math.round(progress * 100)}%</Text>
                                    </XStack>
                                    <View height={10} bg="rgba(255,255,255,0.2)" rounded="$5" overflow="hidden">
                                        <View
                                            height="100%"
                                            bg="$accentColor"
                                            width={`${progress * 100}%`}
                                            rounded="$5"
                                        />
                                    </View>
                                </YStack>
                            )}

                            {scanned && (
                                <Button theme="accent" size="$5" onPress={() => setScanned(false)}>
                                    Scan Again
                                </Button>
                            )}
                        </YStack>
                    </YStack>
                </SafeAreaView>
            </ZStack>
        </Theme>
    );
}
