import React, { useState, useCallback, useEffect } from 'react'
import { InteractionManager, BackHandler } from 'react-native'
import { YStack } from 'tamagui'
import { useRouter, Stack, useLocalSearchParams } from 'expo-router'
import { InputStage } from './InputStage'
import { ConfirmStage } from './ConfirmStage'
import { ReceiveResultStage } from './ReceiveResultStage'
import { RequestEcashStage } from './RequestEcashStage'
import { walletService, mintManager, initService, historyService } from '../../services/core';
import { decodeToken } from '../../services/core/tokenUtils';
import { useWalletStore } from '../../store/walletStore'
import { useSettingsStore } from '../../store/settingsStore'
import { networkService } from '../../services/networkService'
import { nip19, SimplePool } from 'nostr-tools'
import { RELAYS } from '../../services/core/nostrService'
import { deriveSharingKeys, decryptToken } from '../../utils/ecashSharing'
import ReceiveModeSelector, { ReceiveMode } from '../../components/ReceiveModeSelector'
import { ProcessingSheet } from '../../components/UI/ProcessingSheet'
import * as ClipboardAPI from 'expo-clipboard';

type ReceiveStep = 'input' | 'confirm' | 'result';

interface TokenInfo {
    mint: string;
    amount: number;
    proofCount: number;
    preview?: {
        name?: string;
        description?: string;
    };
    p2pkNpub?: string;
}

export function ReceiveModalScreen() {
    const [step, setStep] = useState<ReceiveStep>('input')
    const [receiveMode, setReceiveMode] = useState<ReceiveMode>('receive')
    const [token, setToken] = useState('')
    const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
    const [isDecoding, setIsDecoding] = useState(false)
    const [isReceiving, setIsReceiving] = useState(false)
    const [status, setStatus] = useState<'success' | 'error'>('success')
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()
    const params = useLocalSearchParams<{ scannedToken?: string, requestId?: string, from?: string, username?: string, mode?: string, paste?: string }>()
    const refreshBalance = useWalletStore(s => s.refreshBalance)
    const addMint = useWalletStore(s => s.addMint)
    const fetchMintInfo = useWalletStore(s => s.fetchMintInfo)
    const mints = useWalletStore(s => s.mints)
    const [isReceiveLater, setIsReceiveLater] = useState(false)
    console.log('[ReceiveModalScreen] State - step:', step, 'isReceiving:', isReceiving);

    // Keep a stable ref to mints so handleDecodeToken never needs mints in its deps
    // (avoids infinite re-render when background fetchMintInfo updates the store)
    const mintsRef = React.useRef(mints);
    React.useEffect(() => { mintsRef.current = mints; }, [mints]);
    const fetchMintInfoRef = React.useRef(fetchMintInfo);
    React.useEffect(() => { fetchMintInfoRef.current = fetchMintInfo; }, [fetchMintInfo]);

    const handleDecodeToken = useCallback(async (tokenToDecode?: string) => {
        const targetToken = tokenToDecode || token;
        if (!targetToken.trim()) return;

        setIsDecoding(true);
        setError(null);
        setIsReceiveLater(false);

        try {
            let tokenToParse = targetToken.trim();
            const isShareLink = tokenToParse.includes('/c/#') || tokenToParse.includes('/c#');
            if (isShareLink) {
                const hashIndex = tokenToParse.indexOf('#');
                const secretKeyHex = tokenToParse.slice(hashIndex + 1).trim();
                if (secretKeyHex.length !== 64) {
                    throw new Error('Invalid shared eCash link format');
                }

                console.log('[ReceiveModal] Fetching encrypted token from Nostr...');
                const keys = deriveSharingKeys(secretKeyHex);
                const pool = new SimplePool();
                const event = await pool.get(RELAYS, {
                    authors: [keys.ephemeralPk],
                    kinds: [30078],
                    '#d': [keys.dTag]
                });
                pool.close(RELAYS);

                if (!event) {
                    throw new Error('eCash token link not found or expired on Nostr.');
                }

                tokenToParse = decryptToken(event.content, keys.encryptionKey);
                setToken(tokenToParse);
                console.log('[ReceiveModal] Decrypted eCash token successfully.');
            }

            // Decode using tokenUtils.decodeToken which supports V3, V4 (cashuB/CBOR),
            // and has a manual CBOR fallback that works WITHOUT pre-synced keysets.
            const rawDecoded = decodeToken(tokenToParse);
            console.log('[ReceiveModal] decoded — mint:', rawDecoded.mint, 'proofs:', rawDecoded.proofs?.length);

            const mintUrl = rawDecoded.mint || '';
            const proofs = rawDecoded.proofs || [];
            const amount = rawDecoded.amount ?? proofs.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

            // Check for P2PK pubkey in the first proof secret
            let p2pkNpub: string | undefined;
            try {
                if (proofs.length > 0) {
                    const firstSecret = proofs[0]?.secret;
                    if (typeof firstSecret === 'string' && firstSecret.startsWith('["P2PK"')) {
                        const parsed = JSON.parse(firstSecret);
                        const hexPubkey = parsed[1]?.data;
                        if (hexPubkey) p2pkNpub = nip19.npubEncode(hexPubkey);
                    }
                }
            } catch (e) {
                console.warn('[ReceiveModal] Failed to parse P2PK secret:', e);
            }

            // Show confirm screen immediately — no waiting for network
            setTokenInfo({
                mint: mintUrl || 'Unknown mint',
                amount,
                proofCount: proofs.length,
                preview: undefined,
                p2pkNpub
            });
            setStep('confirm');

            // Fetch mint preview in the background using stable refs
            const normalizeUrl = (url: string) => url.replace(/\/$/, '').toLowerCase();
            const currentMints = mintsRef.current;
            const isTrusted = currentMints.some(m => normalizeUrl(m.mintUrl) === normalizeUrl(mintUrl) && m.trusted);
            if (!isTrusted) {
                fetchMintInfoRef.current(mintUrl)
                    .then((info: any) => {
                        if (info) {
                            setTokenInfo(prev => prev ? {
                                ...prev,
                                preview: { name: info.name, description: info.description }
                            } : prev);
                        }
                    })
                    .catch((e: any) => console.warn('[ReceiveModal] Background mint preview failed:', e));
            }
        } catch (err: any) {
            console.error('[ReceiveModal] Failed to decode token:', err);
            setError(err.message || 'Invalid token format');
        } finally {
            setIsDecoding(false);
        }
    }, [token]); // stable — only depends on token state, reads mints via ref

    React.useEffect(() => {
        console.log('[ReceiveModal] Params updated:', params);
        if (params.scannedToken) {
            let raw = params.scannedToken.trim();
            let lower = raw.toLowerCase();

            // Extract token or request if it's a URL
            if (lower.includes('/c#') || lower.includes('/c/#') || lower.includes('/c/')) {
                const markers = ['/c/#', '/c#', '/c/'];
                for (const marker of markers) {
                    const idx = lower.indexOf(marker);
                    if (idx !== -1) {
                        raw = raw.slice(idx + marker.length);
                        lower = raw.toLowerCase();
                        break;
                    }
                }
            } else if (lower.includes('/r#') || lower.includes('/r/#') || lower.includes('/r/')) {
                const markers = ['/r/#', '/r#', '/r/'];
                for (const marker of markers) {
                    const idx = lower.indexOf(marker);
                    if (idx !== -1) {
                        raw = raw.slice(idx + marker.length);
                        lower = raw.toLowerCase();
                        break;
                    }
                }
            }

            // NUT-18 Payment Request — redirect to Send modal, don't decode as token
            if (lower.startsWith('creqa') || lower.startsWith('creqb') || lower.startsWith('creq')) {
                console.log('[ReceiveModal] Detected NUT-18 payment request, redirecting to send...');
                router.replace({
                    pathname: '/(modals)/send',
                    params: { paymentRequest: raw },
                });
                return;
            }

            setToken(raw);
            handleDecodeToken(raw);
        } else if (params.requestId || params.from) {
            setReceiveMode('request');
        } else if (params.mode) {
            setReceiveMode(params.mode as ReceiveMode);
        }

        if (params.paste === 'true') {
            console.log('[ReceiveModal] Auto-paste check triggered');
            ClipboardAPI.getStringAsync().then((text) => {
                console.log('[ReceiveModal] Retrieved clipboard text:', text ? `${text.slice(0, 20)}...` : 'empty');
                if (text && text.trim()) {
                    let trimmed = text.trim();
                    let lower = trimmed.toLowerCase();

                    // Extract token or request if it's a URL
                    if (lower.includes('/c#') || lower.includes('/c/#') || lower.includes('/c/')) {
                        const markers = ['/c/#', '/c#', '/c/'];
                        for (const marker of markers) {
                            const idx = lower.indexOf(marker);
                            if (idx !== -1) {
                                trimmed = trimmed.slice(idx + marker.length);
                                lower = trimmed.toLowerCase();
                                break;
                            }
                        }
                    } else if (lower.includes('/r#') || lower.includes('/r/#') || lower.includes('/r/')) {
                        const markers = ['/r/#', '/r#', '/r/'];
                        for (const marker of markers) {
                            const idx = lower.indexOf(marker);
                            if (idx !== -1) {
                                trimmed = trimmed.slice(idx + marker.length);
                                lower = trimmed.toLowerCase();
                                break;
                            }
                        }
                    }

                    // NUT-18 Payment Request — redirect to Send modal, don't decode as token
                    if (lower.startsWith('creqa') || lower.startsWith('creqb') || lower.startsWith('creq')) {
                        console.log('[ReceiveModal] Clipboard auto-paste detected NUT-18 payment request, redirecting to send...');
                        router.replace({
                            pathname: '/(modals)/send',
                            params: { paymentRequest: trimmed },
                        });
                        return;
                    }

                    setToken(trimmed);
                }
            }).catch(err => {
                console.warn('[ReceiveModal] Failed to auto-paste from clipboard:', err);
            });
        }
    }, [params.scannedToken, params.requestId, params.from, params.mode, params.paste]);

    const handleReceiveLater = useCallback(async () => {
        if (!tokenInfo) return;

        setError(null);

        try {
            const mintUrl = tokenInfo.mint;
            console.log('[ReceiveModal] Saving for later:', mintUrl);

            // 1. Ensure mint is added/known (optional but good for UI consistency)
            const knownMints = mints.map(m => m.mintUrl.toLowerCase());
            if (!knownMints.includes(mintUrl.toLowerCase())) {
                addMint(mintUrl, { trusted: true }).catch(e => {
                    console.warn('[ReceiveModal] Failed to add mint in background during save later:', e);
                });
            }

            // 2. Decode to get the full token object for storage
            const decoded = decodeToken(token.trim());

            // 3. Add to history as 'unclaimed' receive
            const repo = initService.getRepo();
            await (repo.historyRepository as any).addHistoryEntry({
                mintUrl,
                type: 'receive',
                unit: 'sat',
                amount: tokenInfo.amount,
                createdAt: Date.now(),
                state: 'unclaimed',
                token: decoded,
                metadata: {
                    type: tokenInfo.p2pkNpub ? 'p2pk' : 'standard',
                    p2pkPubkey: tokenInfo.p2pkNpub ? nip19.decode(tokenInfo.p2pkNpub).data : undefined
                }
            });

            setStatus('success');
            setIsReceiveLater(true);
            setStep('result');
        } catch (err: any) {
            console.error('[ReceiveModal] Failed to save token for later:', err);
            setError(err.message || 'Failed to save for later');
            setStatus('error');
            setStep('result');
        }
    }, [token, tokenInfo, mints, addMint]);

    const handleReceive = useCallback(async () => {
        if (!tokenInfo) return;

        const offline = await networkService.isOffline();
        if (offline) {
            setError('You are offline. Please check your internet connection.');
            setStatus('error');
            setStep('result');
            return;
        }

        setIsReceiving(true);
        setError(null);

        try {
            const mintUrl = tokenInfo.mint;
            console.log('[ReceiveModal] Starting receive for mint:', mintUrl);

            // 1. Trust the mint if not already — skip network call for known trusted mints
            const normalizeUrl = (url: string) => url.replace(/\/$/, '').toLowerCase();
            const alreadyTrusted = mints.some(m => normalizeUrl(m.mintUrl) === normalizeUrl(mintUrl) && m.trusted);
            if (!alreadyTrusted) {
                try {
                    console.log('[ReceiveModal] Adding and trusting mint:', mintUrl);
                    await addMint(mintUrl, { trusted: true });
                } catch (e: any) {
                    console.warn('[ReceiveModal] Mint add/trust error:', e?.message);
                }
            }

            // 2. Fire-and-forget keyset repair — don't block receive on a local DB fix
            mintManager.repairMintKeysets(mintUrl, 'sat').catch(e =>
                console.warn('[ReceiveModal] Keyset repair warning:', e)
            );

            // 3. Receive the token
            console.log('[ReceiveModal] Calling walletService.receive...');
            const { nsec } = useSettingsStore.getState();

            try {
                await walletService.receive(token.trim());
            } catch (receiveErr: any) {
                const errMsg = receiveErr?.message?.toLowerCase() || '';
                const isP2PKError = errMsg.includes('signature') ||
                    errMsg.includes('lock') ||
                    errMsg.includes('p2pk') ||
                    errMsg.includes('key pair not found') ||
                    errMsg.includes('public key');

                if (isP2PKError && nsec) {
                    console.log('[ReceiveModal] Standard receive failed, trying P2PK receive...');
                    let targetPrivkey = nsec;
                    if (targetPrivkey.startsWith('nsec')) {
                        try {
                            const decoded = nip19.decode(targetPrivkey);
                            if (decoded.type === 'nsec') {
                                targetPrivkey = Buffer.from(decoded.data as Uint8Array).toString('hex');
                            }
                        } catch (e: any) {
                            console.warn('[ReceiveModal] Failed to decode nsec:', e);
                        }
                    }
                    await walletService.receiveP2PK(token.trim(), targetPrivkey);
                } else {
                    throw receiveErr;
                }
            }

            // 4. Show success immediately — refresh balance in background
            setStatus('success');
            setIsReceiveLater(false);
            setStep('result');
            refreshBalance(); // fire-and-forget, balance banner will update async

            // 5. Tag history with how the token was received (fire-and-forget)
            const via = params.from === 'nfc' ? 'nfc'
                      : params.scannedToken   ? 'qr'
                      : 'paste';
            historyService.tagHistoryVia(tokenInfo.mint, 'receive', via).catch(() => {});
        } catch (err: any) {
            console.error('[ReceiveModal] ❌ Failed to receive token:', {
                message: err?.message,
                name: err?.name,
                mint: tokenInfo?.mint,
            });
            setError(err.message || 'Failed to receive token');
            setStatus('error');
            setStep('result');
        } finally {
            setIsReceiving(false);
        }
    }, [token, tokenInfo, mints, refreshBalance, addMint]);

    const handleNext = () => {
        if (step === 'input') handleDecodeToken();
        else if (step === 'confirm') handleReceive();
    }

    const handleClose = useCallback(() => {
        if (!params.scannedToken && router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)');
        }
        InteractionManager.runAfterInteractions(() => refreshBalance());
    }, [params.scannedToken, router, refreshBalance]);

    const handleBack = useCallback(() => {
        if (step === 'confirm' && !params.scannedToken) {
            setStep('input');
            setTokenInfo(null);
            setError(null);
        } else {
            handleClose();
        }
    }, [step, params.scannedToken, handleClose]);

    // Handle OS hardware back button (Android) safely for deep links
    useEffect(() => {
        const onBackPress = () => {
            handleBack();
            return true; // prevent default exit/crash
        };
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [handleBack]);

    const headerTitle = React.useMemo(() => {
        if (step === 'result') return status === 'success' ? 'Success' : 'Error';
        if (receiveMode === 'request') return 'Request Payment';
        return 'Receive Ecash';
    }, [step, status, receiveMode]);

    return (
        <YStack flex={1} bg="$background" >
            <Stack.Screen
                options={{
                    headerTitle: headerTitle,
                    headerBackTitle: 'Back',
                }}
            />

            {/* ── Receive: existing paste/scan flow ─────────────────────── */}
            {receiveMode === 'receive' && step === 'input' && (
                <InputStage
                    token={token}
                    setToken={setToken}
                    isLoading={isDecoding}
                    error={error}
                    onContinue={handleNext}
                    onScanPress={() => {
                        router.push({
                            pathname: '/(modals)/scanner',
                            params: { returnTo: '/receive' }
                        });
                    }}
                />
            )}

            {/* ── Request Ecash: self-contained amount + result flow ─────── */}
            {receiveMode === 'request' && (
                <RequestEcashStage 
                    onClose={handleClose} 
                    initialRequestId={params.requestId} 
                    targetNpub={params.from}
                    targetUsername={params.username}
                />
            )}


            {step === 'confirm' && tokenInfo && (
                <ConfirmStage
                    token={token}
                    tokenInfo={tokenInfo}
                    isLoading={isReceiving}
                    onConfirm={handleNext}
                    onReceiveLater={handleReceiveLater}
                    onBack={handleBack}
                />
            )}

            {step === 'result' && (
                <ReceiveResultStage
                    status={status}
                    amount={tokenInfo?.amount?.toString() || "0"}
                    mintUrl={tokenInfo?.mint}
                    token={token}
                    error={error}
                    isReceiveLater={isReceiveLater}
                    isLoading={isReceiving}
                    onClaimNow={handleReceive}
                    onClose={handleClose}
                    title={status === 'success' ? (isReceiveLater ? 'Token Saved' : 'Ecash Received') : 'Receive Failed'}
                />
            )}

            {/* Global ProcessingSheet to prevent unmounting bugs during step transitions */}
            <ProcessingSheet
                visible={isReceiving}
                title="Receiving"
                amount={tokenInfo?.amount || 0}
                detail={tokenInfo ? `Receiving from ${tokenInfo.preview?.name || tokenInfo.mint.replace(/^https?:\/\//, '').split('/')[0]}` : 'Receiving...'}
            />
        </YStack>
    )
}
