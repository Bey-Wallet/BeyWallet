import React, { useState, useEffect, useRef } from 'react'
import { YStack, XStack, Text, Button, View, Input } from 'tamagui'
import { AtSign, CheckCircle, XCircle, Globe, Check } from '@tamagui/lucide-icons'
import { ActivityIndicator } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useSettingsStore } from '../../store/settingsStore'
import { nip19 } from 'nostr-tools'
import { Buffer } from 'buffer'

interface NostrStepProps {
    onComplete: () => void
    onSkip: () => void
}

const DOMAIN = 'bey.cash';
const API_BASE = 'https://bey.cash/api';

function npubToHex(npub: string): string | null {
    if (!npub) return null;
    if (/^[0-9a-fA-F]{64}$/.test(npub)) return npub;
    try {
        const decoded = nip19.decode(npub);
        if (decoded.type === 'npub') {
            return typeof decoded.data === 'string' 
                ? decoded.data 
                : Buffer.from(decoded.data as unknown as Uint8Array).toString('hex');
        }
    } catch (e) {
        console.error('[NostrStep] npub decode error:', e);
    }
    return null;
}

function nsecToHex(nsec: string): string | null {
    if (!nsec) return null;
    if (/^[0-9a-fA-F]{64}$/.test(nsec)) return nsec;
    try {
        const decoded = nip19.decode(nsec);
        if (decoded.type === 'nsec') {
            return typeof decoded.data === 'string' 
                ? decoded.data 
                : Buffer.from(decoded.data as unknown as Uint8Array).toString('hex');
        }
    } catch (e) {
        console.error('[NostrStep] nsec decode error:', e);
    }
    return null;
}

async function checkAvailability(username: string): Promise<'available' | 'taken' | 'error'> {
    try {
        const res = await fetch(
            `${API_BASE}/register?check=${encodeURIComponent(username)}`,
            { headers: { Accept: 'application/json' } }
        );
        if (!res.ok) return 'error';
        const data = await res.json();
        if (data?.available === true) return 'available';
        if (data?.available === false) return 'taken';
        return 'error';
    } catch { return 'error'; }
}

async function registerUsername(
    username: string,
    hexPubkey: string,
    hexPrivkey: string
): Promise<{ ok: boolean; error?: string; nip05?: string }> {
    try {
        const { finalizeEvent } = require('nostr-tools/pure');
        const { hexToBytes } = require('@noble/hashes/utils');

        const privkeyBytes = hexToBytes(hexPrivkey);
        const proofEvent = finalizeEvent({
            kind: 22242,
            created_at: Math.floor(Date.now() / 1000),
            tags: [],
            content: JSON.stringify({
                username: username.toLowerCase(),
                domain: DOMAIN,
                action: 'register',
            }),
        }, privkeyBytes);

        const res = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username.toLowerCase(),
                pubkey: hexPubkey,
                proofEvent,
            }),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => null);
            const errMsg = data?.error || `Server error ${res.status}`;
            return { ok: false, error: errMsg };
        }

        const data = await res.json().catch(() => null);
        if (!data?.success) return { ok: false, error: 'Registration response invalid' };
        
        return { ok: true, nip05: data.nip05 };
    } catch (e: any) {
        return { ok: false, error: e?.message || 'Network error' };
    }
}

type CheckState = 'idle' | 'checking' | 'available' | 'taken' | 'error';

export function NostrStep({ onComplete, onSkip }: NostrStepProps) {
    const { npub, nsec, setNip05 } = useSettingsStore();

    const [input, setInput] = useState('');
    const [checkState, setCheckState] = useState<CheckState>('idle');
    const [isRegistering, setIsRegistering] = useState(false);
    const [isDone, setIsDone] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isValidFormat = /^[a-z0-9_.-]{1,64}$/.test(input);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!input || !isValidFormat) {
            setCheckState('idle');
            return;
        }
        setCheckState('checking');
        debounceRef.current = setTimeout(async () => {
            const result = await checkAvailability(input);
            setCheckState(result);
        }, 500);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [input, isValidFormat]);

    const handleClaim = async () => {
        if (!npub || !nsec || checkState !== 'available') return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const hexPub = npubToHex(npub);
        const hexSec = nsecToHex(nsec);
        if (!hexPub || !hexSec) {
            setErrorMsg('Could not decode keys.');
            return;
        }

        setIsRegistering(true);
        setErrorMsg(null);
        try {
            const result = await registerUsername(input, hexPub, hexSec);
            if (result.ok) {
                const identifier = `${input}@${DOMAIN}`;
                await setNip05(identifier);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setIsDone(true);
                setTimeout(() => {
                    onComplete();
                }, 1500);
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                setErrorMsg(result.error || 'Registration failed');
            }
        } finally {
            setIsRegistering(false);
        }
    };

    const CheckIcon = () => {
        if (!input || !isValidFormat) return null;
        if (checkState === 'checking') return <ActivityIndicator size="small" color="#888" />;
        if (checkState === 'available') return <CheckCircle size={20} color="$green10" />;
        if (checkState === 'taken') return <XCircle size={20} color="$red10" />;
        return null;
    };

    const checkMessage = () => {
        if (!input) return null;
        if (!isValidFormat) return { text: 'Only lowercase letters, numbers, _ . - allowed', color: '$orange10' };
        if (checkState === 'checking') return { text: 'Checking availability…', color: '$gray10' };
        if (checkState === 'available') return { text: `✓ ${input}@${DOMAIN} is available!`, color: '$green10' };
        if (checkState === 'taken') return { text: `✗ ${input}@${DOMAIN} is already taken`, color: '$red10' };
        if (checkState === 'error') return { text: 'Could not check availability — try again', color: '$orange10' };
        return null;
    };

    const msg = checkMessage();

    return (
        <YStack flex={1} bg="$background" px="$4" py="$6" justify="space-between">
            {/* Top spacer / Skip */}
            <XStack justify="flex-end" w="100%">
                {!isDone && (
                    <Button chromeless size="$3" onPress={onSkip} pressStyle={{ opacity: 0.5 }}>
                        <Text color="$gray10" fontWeight="600">Skip</Text>
                    </Button>
                )}
            </XStack>

            {/* Center Content */}
            <YStack items="center" gap="$5" pt="$4">
                {isDone ? (
                    <YStack items="center" gap="$4">
                        <View
                            bg="$green9"
                            width={80}
                            height={80}
                            rounded="$10"
                            items="center"
                            justify="center"
                            animation="quick"
                            enterStyle={{ scale: 0, opacity: 0 }}
                        >
                            <Check size={40} color="white" />
                        </View>
                        <YStack items="center" gap="$2">
                            <Text fontWeight="800" fontSize="$6">Username Claimed! 🎉</Text>
                            <Text color="$gray10" fontSize="$4">{input}@{DOMAIN}</Text>
                        </YStack>
                    </YStack>
                ) : (
                    <YStack gap="$5" w="100%">
                        <YStack items="center" gap="$2">
                            <Globe size={48} color="$blue10" />
                            <Text fontWeight="800" fontSize="$7">Nostr Address</Text>
                            <Text color="$gray10" fontSize="$3" lineHeight={20} text="center" px="$4">
                                Claim a free <Text fontWeight="700" color="$color">username@{DOMAIN}</Text> identifier.
                                It lets others find and verify you on Nostr.
                            </Text>
                        </YStack>

                        <YStack gap="$2" mt="$4">
                            <Text fontWeight="700" fontSize="$4">Choose a username</Text>
                            <XStack
                                bg="$gray2"
                                rounded="$4"
                                borderWidth={1}
                                borderColor={
                                    checkState === 'available' ? '$green8'
                                        : checkState === 'taken' ? '$red8'
                                        : '$borderColor'
                                }
                                items="center"
                                px="$3"
                                gap="$2"
                            >
                                <AtSign size={18} color="$gray10" />
                                <Input
                                    flex={1}
                                    bg="transparent"
                                    borderWidth={0}
                                    placeholder="yourname"
                                    value={input}
                                    onChangeText={v => setInput(v.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType="ascii-capable"
                                    fontSize="$5"
                                    fontWeight="600"
                                />
                                <Text color="$gray9" fontSize="$3">@{DOMAIN}</Text>
                                <CheckIcon />
                            </XStack>

                            {msg && (
                                <Text fontSize="$2" color={msg.color as any} mt="$1">
                                    {msg.text}
                                </Text>
                            )}
                        </YStack>
                    </YStack>
                )}
            </YStack>

            {/* Bottom - Enable Button */}
            <YStack gap="$4" items="center" pb="$4">
                {errorMsg && !isDone && (
                    <Text color="$red10" fontSize="$3" text="center">
                        {errorMsg}
                    </Text>
                )}

                {!isDone && (
                    <Button
                        size="$5"
                        theme="accent"
                        width="100%"
                        disabled={checkState !== 'available' || isRegistering}
                        onPress={handleClaim}
                        opacity={isRegistering || checkState !== 'available' ? 0.7 : 1}
                        icon={isRegistering
                            ? <ActivityIndicator size="small" color="white" />
                            : <Globe size={20} />
                        }
                        fontSize="$5"
                        fontWeight="700"
                        rounded="$4"
                        pressStyle={{ scale: 0.98, opacity: 0.9 }}
                    >
                        {isRegistering ? 'Claiming...' : 'Claim Username'}
                    </Button>
                )}

                {!isDone && (
                    <Text color="$gray9" fontSize="$2" text="center">
                        Optional: Makes it easier for others to send you payments
                    </Text>
                )}
            </YStack>
        </YStack>
    )
}
