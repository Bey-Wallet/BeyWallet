import React, { useState, useCallback } from 'react'
import { YStack } from 'tamagui'
import { useRouter, Stack, useLocalSearchParams } from 'expo-router'
import { InputStage } from './InputStage'
import { ConfirmStage } from './ConfirmStage'
import { ReceiveResultStage } from './ReceiveResultStage'
import { RequestEcashStage } from './RequestEcashStage'
import { walletService, decodeToken, mintManager, initService } from '../../services/core';
import { useWalletStore } from '../../store/walletStore'
import { useSettingsStore } from '../../store/settingsStore'
import { nip19 } from 'nostr-tools'
import ReceiveModeSelector, { ReceiveMode } from '../../components/ReceiveModeSelector'

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
    const params = useLocalSearchParams<{ scannedToken?: string }>()
    const { refreshBalance, addMint, fetchMintInfo, mints } = useWalletStore()

    const [isReceiveLater, setIsReceiveLater] = useState(false)

    React.useEffect(() => {
        if (params.scannedToken) {
            setToken(params.scannedToken);
            handleDecodeToken(params.scannedToken);
        }
    }, [params.scannedToken]);

    const handleDecodeToken = useCallback(async (tokenToDecode?: string) => {
        const targetToken = tokenToDecode || token;
        if (!targetToken.trim()) return;

        setIsDecoding(true);
        setError(null);
        setIsReceiveLater(false);

        try {
            const decoded = decodeToken(targetToken.trim());
            const mintUrl = decoded.mint;

            // Calculate total amount from proofs
            const amount = decoded.proofs?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;

            let previewInfo;

            // Check if mint is already trusted
            const normalizeUrl = (url: string) => url.replace(/\/$/, '').toLowerCase();
            const isTrusted = mints.some(m => normalizeUrl(m.mintUrl) === normalizeUrl(mintUrl) && m.trusted);

            if (!isTrusted) {
                try {
                    console.log('[ReceiveModal] Fetching mint preview for:', mintUrl);
                    const info = await fetchMintInfo(mintUrl);
                    previewInfo = {
                        name: info?.name,
                        description: info?.description
                    };
                } catch (e) {
                    console.warn('[ReceiveModal] Failed to fetch mint preview:', e);
                }
            }

            // Check for P2PK pubkey in the first proof secret
            let p2pkNpub: string | undefined;
            try {
                if (decoded.proofs && decoded.proofs.length > 0) {
                    const firstSecret = decoded.proofs[0]?.secret;
                    if (typeof firstSecret === 'string') {
                        // V3 format: '["P2PK",{"data":"02..."}]'
                        if (firstSecret.startsWith('["P2PK"')) {
                            const parsed = JSON.parse(firstSecret);
                            const hexPubkey = parsed[1]?.data;
                            if (hexPubkey) {
                                p2pkNpub = nip19.npubEncode(hexPubkey);
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('[ReceiveModal] Failed to parse P2PK secret:', e);
            }

            setTokenInfo({
                mint: mintUrl || 'Unknown mint',
                amount: amount,
                proofCount: decoded.proofs?.length || 0,
                preview: previewInfo,
                p2pkNpub
            });
            setStep('confirm');
        } catch (err: any) {
            console.error('[ReceiveModal] Failed to decode token:', err);
            setError(err.message || 'Invalid token format');
        } finally {
            setIsDecoding(false);
        }
    }, [token, mints, fetchMintInfo]);

    const handleReceiveLater = useCallback(async () => {
        if (!tokenInfo) return;

        setIsReceiving(true);
        setError(null);

        try {
            const mintUrl = tokenInfo.mint;
            console.log('[ReceiveModal] Saving for later:', mintUrl);

            // 1. Ensure mint is added/known (optional but good for UI consistency)
            try {
                const knownMints = mints.map(m => m.mintUrl.toLowerCase());
                if (!knownMints.includes(mintUrl.toLowerCase())) {
                    await addMint(mintUrl, { trusted: true });
                }
            } catch (e) {
                console.warn('[ReceiveModal] Failed to add mint during save later:', e);
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
        } finally {
            setIsReceiving(false);
        }
    }, [token, tokenInfo, mints, addMint]);

    const handleReceive = useCallback(async () => {
        if (!tokenInfo) return;

        setIsReceiving(true);
        setError(null);

        try {
            const mintUrl = tokenInfo.mint;
            console.log('[ReceiveModal] Starting receive for mint:', mintUrl);

            // 1. Ensure mint is trusted. Using store.addMint ensures UI refreshes.
            try {
                const isTrusted = await mintManager.isMintTrusted(mintUrl);
                if (!isTrusted) {
                    console.log('[ReceiveModal] Adding and trusting mint via store:', mintUrl);
                    await addMint(mintUrl, { trusted: true });
                }
            } catch (e: any) {
                console.warn('[ReceiveModal] Mint add/trust error:', e?.message);
            }

            // 2. Repair keysets (fix empty unit values)
            try {
                await mintManager.repairMintKeysets(mintUrl, 'sat');
            } catch (e) {
                console.warn('[ReceiveModal] Keyset repair warning:', e);
            }

            // 3. Receive the token via core wallet service
            console.log('[ReceiveModal] Calling walletService.receive...');

            // Check if we have Nostr keys for potential P2PK receive
            const { nsec } = useSettingsStore.getState();

            try {
                // First try standard receive. If it's locked to our pubkey, it might fail unless we explicitly pass privkey.
                // However, cashu-ts receive() might just fail if it needs a signature and we don't provide it in the options.
                // Or we can just ALWAYS try receiveP2PK if standard fails with 'No signature' or similar P2PK error.
                // For safety, let's try standard first, catch specific P2PK errors, then try receiveP2PK.
                await walletService.receive(token.trim());
            } catch (receiveErr: any) {
                const errMsg = receiveErr?.message?.toLowerCase() || '';
                const isP2PKError = errMsg.includes('signature') ||
                    errMsg.includes('lock') ||
                    errMsg.includes('p2pk') ||
                    errMsg.includes('key pair not found') ||
                    errMsg.includes('public key');

                if (isP2PKError && nsec) {
                    console.log('[ReceiveModal] Standard receive failed, attempting P2PK receive...');

                    let targetPrivkey = nsec;
                    // Decode nsec to hex if necessary
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
                    throw receiveErr; // Re-throw if not P2PK related or we don't have the key
                }
            }

            setStatus('success');
            setIsReceiveLater(false);
            await refreshBalance();
            setStep('result');
        } catch (err: any) {
            console.error('[ReceiveModal] ❌ Failed to receive token:', {
                message: err?.message,
                name: err?.name,
                code: err?.code,
                stack: err?.stack?.substring(0, 500),
                mint: tokenInfo?.mint,
            });
            setError(err.message || 'Failed to receive token');
            setStatus('error');
            setStep('result');
        } finally {
            setIsReceiving(false);
        }
    }, [token, tokenInfo, refreshBalance]);

    const handleNext = () => {
        if (step === 'input') handleDecodeToken();
        else if (step === 'confirm') handleReceive();
    }

    const handleBack = () => {
        if (step === 'confirm') {
            setStep('input');
            setTokenInfo(null);
            setError(null);
        }
        else router.back();
    }

    const handleClose = () => {
        refreshBalance();
        router.back();
    }

    return (
        <YStack flex={1} bg="$background" >
            <Stack.Screen
                options={{
                    headerTitle: step === 'result'
                        ? (status === 'success' ? 'Success' : 'Error')
                        : () => (
                            <ReceiveModeSelector
                                mode={receiveMode}
                                onSelect={(m) => {
                                    setReceiveMode(m);
                                    // Reset any pending state when switching
                                    setError(null);
                                    setToken('');
                                    setTokenInfo(null);
                                    setStep('input');
                                }}
                                isLoading={isDecoding || isReceiving}
                            />
                        ),
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
                <RequestEcashStage onClose={handleClose} />
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
        </YStack>
    )
}
