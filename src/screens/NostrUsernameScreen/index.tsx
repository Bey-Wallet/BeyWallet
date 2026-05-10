import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    YStack, XStack, Text, Button, View, ScrollView, Input, Separator
} from 'tamagui';
import { ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import {
    AtSign, CheckCircle, XCircle, Globe, Copy, Trash2
} from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useToastController } from '@tamagui/toast';
import { useSettingsStore } from '../../store/settingsStore';
import { nip19 } from 'nostr-tools';
import { finalizeEvent } from 'nostr-tools/pure';
import { Buffer } from 'buffer';

/** Convert hex string to Uint8Array — inline to avoid @noble/hashes/utils export issues */
function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}

// ─── bey.cash API (self-hosted NIP-05 on Nostr) ───────────────────────────────

const DOMAIN = 'bey.cash';
const API_BASE = 'https://bey.cash/api';

function npubToHex(npub: string): string | null {
    if (!npub) return null;
    if (/^[0-9a-fA-F]{64}$/.test(npub)) return npub;
    try {
        const decoded = nip19.decode(npub);
        if (decoded.type === 'npub') {
            // nostr-tools v2 nip19.decode('npub...') returns the hex string directly
            return typeof decoded.data === 'string' 
                ? decoded.data 
                : Buffer.from(decoded.data as unknown as Uint8Array).toString('hex');
        }
    } catch (e) {
        console.error('[NostrUsername] npub decode error:', e);
    }
    return null;
}

/** Convert nsec → hex seckey */
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
        console.error('[NostrUsername] nsec decode error:', e);
    }
    return null;
}

/** Check if a username is taken on bey.cash */
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

/** Register username on bey.cash using signed proof event */
async function registerUsername(
    username: string,
    hexPubkey: string,
    hexPrivkey: string
): Promise<{ ok: boolean; error?: string; nip05?: string }> {
    try {
        // Create a proof event (Kind 22242) to prove key ownership
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
            console.error(`[NostrUsername] Registration failed (${res.status}):`, errMsg);
            return { ok: false, error: errMsg };
        }

        const data = await res.json().catch(() => null);
        if (!data?.success) return { ok: false, error: 'Registration response invalid' };
        
        return { ok: true, nip05: data.nip05 };
    } catch (e: any) {
        return { ok: false, error: e?.message || 'Network error' };
    }
}

// (Note: Username deletion requires the registrar key — handled server-side only)

// ─── Component ────────────────────────────────────────────────────────────────

type CheckState = 'idle' | 'checking' | 'available' | 'taken' | 'error';

export function NostrUsernameScreen() {
    const toast = useToastController();
    const router = useRouter();
    const { npub, nsec, nip05, setNip05 } = useSettingsStore();

    const [input, setInput] = useState('');
    const [checkState, setCheckState] = useState<CheckState>('idle');
    const [isRegistering, setIsRegistering] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Validate username characters
    const isValidFormat = /^[a-z0-9_.-]{1,64}$/.test(input);

    // Debounced availability check
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
    }, [input]);

    const handleClaim = async () => {
        if (!npub || !nsec || checkState !== 'available') return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const hexPub = npubToHex(npub);
        const hexSec = nsecToHex(nsec);
        if (!hexPub || !hexSec) {
            toast.show('Error', { message: 'Could not decode keys', duration: 3000 });
            return;
        }

        setIsRegistering(true);
        try {
            const result = await registerUsername(input, hexPub, hexSec);
            if (result.ok) {
                const identifier = `${input}@${DOMAIN}`;
                await setNip05(identifier);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                toast.show('Username Claimed! 🎉', {
                    message: `You are now ${identifier}`,
                    duration: 4000,
                });
                setInput('');
                setCheckState('idle');
                // Navigate back after a short delay so user sees the success
                setTimeout(() => {
                    router.back();
                }, 1500);
            } else {
                toast.show('Failed', { message: result.error || 'Registration failed', duration: 4000 });
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
        } finally {
            setIsRegistering(false);
        }
    };

    const handleDelete = async () => {
        if (!nip05) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await setNip05(null);
        toast.show('Username local reference removed', { duration: 2500 });
    };

    const handleCopyIdentifier = async () => {
        if (!nip05) return;
        await Clipboard.setStringAsync(nip05);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast.show('Copied!', { message: nip05, duration: 2000 });
    };

    // ─── Check icon ─────────────────────────────────────────────────────────
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
        <ScrollView bg="$background" showsVerticalScrollIndicator={false}>
            <YStack px="$4" pt="$4" pb="$12" gap="$6">

                {/* Current identifier */}
                {nip05 ? (
                    <YStack gap="$3">
                        <Text fontWeight="700" fontSize="$5">Your Nostr Address</Text>
                        <YStack bg="$gray2" rounded="$5" overflow="hidden">
                            <XStack px="$4" py="$4" items="center" gap="$3">
                                <View bg="$green3" p="$2" rounded="$10">
                                    <CheckCircle size={20} color="$green10" />
                                </View>
                                <YStack flex={1}>
                                    <Text fontWeight="800" fontSize="$5" color="$green10">
                                        {nip05}
                                    </Text>
                                    <Text fontSize="$2" color="$gray10" mt="$0.5">
                                        Your verified Nostr identifier
                                    </Text>
                                </YStack>
                            </XStack>
                            <Separator borderColor="$borderColor" opacity={0.5} />
                            <XStack>
                                <Button
                                    flex={1}
                                    size="$4"
                                    chromeless
                                    icon={<Copy size={16} color="$gray10" />}
                                    onPress={handleCopyIdentifier}
                                >
                                    <Text color="$gray10" fontWeight="600">Copy</Text>
                                </Button>
                                <Separator vertical borderColor="$borderColor" opacity={0.5} />
                                <Button
                                    flex={1}
                                    size="$4"
                                    chromeless
                                    icon={<Trash2 size={16} color="$red10" />}
                                    onPress={handleDelete}
                                >
                                    <Text color="$red10" fontWeight="600">Remove</Text>
                                </Button>
                            </XStack>
                        </YStack>
                    </YStack>
                ) : (
                    /* ─── Claim flow ──────────────────────────────────── */
                    <YStack gap="$5">
                        {/* Header */}
                        <YStack gap="$2">
                            <Text fontWeight="800" fontSize="$7">Get a Nostr Address</Text>
                            <Text color="$gray10" fontSize="$3" lineHeight={20}>
                                Claim a free <Text fontWeight="700" color="$color">username@{DOMAIN}</Text> identifier.
                                It lets others find and verify you on Nostr.
                            </Text>
                        </YStack>

                        {/* Input */}
                        <YStack gap="$2">
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

                        {/* Claim button */}
                        <Button
                            size="$5"
                            themeInverse
                            fontWeight="800"
                            disabled={checkState !== 'available' || isRegistering}
                            onPress={handleClaim}
                            opacity={isRegistering ? 0.7 : 1}
                            icon={isRegistering
                                ? <ActivityIndicator size="small" color="white" />
                                : <Globe size={20} />
                            }
                        >
                            {isRegistering ? 'Claiming Username...' : 'Claim Username'}
                        </Button>

                        {/* Info box */}
                        <YStack bg="$gray2" p="$4" rounded="$4" gap="$2">
                            <Text fontWeight="700" fontSize="$3">What is a Nostr address?</Text>
                            <Text fontSize="$2" color="$gray10" lineHeight={18}>
                                A NIP-05 identifier (like an email address) lets other Nostr users
                                find and verify you. It appears as <Text fontWeight="700">you@{DOMAIN}</Text> in
                                compatible apps. Registration is free and powered by Bey Wallet.
                            </Text>
                        </YStack>
                    </YStack>
                )}
            </YStack>
        </ScrollView>
    );
}
