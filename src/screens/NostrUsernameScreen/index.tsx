import React, { useState, useEffect, useRef } from 'react';
import {
    YStack, XStack, Text, Button, View, ScrollView, Input, Separator
} from 'tamagui';
import { ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { networkService } from '../../services/networkService';
import {
    AtSign, CheckCircle, XCircle, Globe, Copy, Trash2, Edit3
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

/** Unregister username on bey.cash using signed proof event */
async function unregisterUsername(
    username: string,
    hexPubkey: string,
    hexPrivkey: string
): Promise<{ ok: boolean; error?: string }> {
    try {
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
            method: 'DELETE',
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
            console.error(`[NostrUsername] Deletion failed (${res.status}):`, errMsg);
            return { ok: false, error: errMsg };
        }

        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: e?.message || 'Network error' };
    }
}

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
    
    // Editing states
    const [isEditing, setIsEditing] = useState(false);
    const [oldUsername, setOldUsername] = useState('');

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
        
        // If they enter their exact current name, mark it available immediately
        if (isEditing && input.toLowerCase() === oldUsername.toLowerCase()) {
            setCheckState('available');
            return;
        }

        setCheckState('checking');
        debounceRef.current = setTimeout(async () => {
            const offline = await networkService.isOffline();
            if (offline) {
                setCheckState('error');
                return;
            }
            const result = await checkAvailability(input);
            setCheckState(result);
        }, 500);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [input, isEditing, oldUsername]);

    const handleClaim = async () => {
        if (!npub || !nsec) {
            toast.show('Error', { message: 'Missing keys. Please re-authenticate.', duration: 3000 });
            return;
        }
        
        if (checkState !== 'available') return;

        const offline = await networkService.checkOfflineAndAlert('claim username');
        if (offline) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const hexPub = npubToHex(npub);
        const hexSec = nsecToHex(nsec);
        if (!hexPub || !hexSec) {
            toast.show('Error', { message: 'Could not decode keys', duration: 3000 });
            return;
        }

        setIsRegistering(true);
        try {
            // 1. If editing, first unregister the old username from the network
            if (isEditing && oldUsername && oldUsername.toLowerCase() !== input.toLowerCase()) {
                console.log(`[NostrUsername] Releasing old username: ${oldUsername}`);
                const deleteResult = await unregisterUsername(oldUsername, hexPub, hexSec);
                if (!deleteResult.ok) {
                    toast.show('Warning', { message: `Could not release old name: ${deleteResult.error}`, duration: 4000 });
                }
            }

            // 2. Register the new username
            const result = await registerUsername(input, hexPub, hexSec);
            if (result.ok) {
                const identifier = `${input}@${DOMAIN}`;
                await setNip05(identifier);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                toast.show('Username Updated! 🎉', {
                    message: `You are now ${identifier}`,
                    duration: 4000,
                });
                setInput('');
                setCheckState('idle');
                setIsEditing(false);
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
        if (!nip05 || !npub || !nsec) return;

        Alert.alert(
            'Delete Username',
            `Are you sure you want to delete ${nip05} from Nostr registries? This username will become available for others to claim.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const offline = await networkService.checkOfflineAndAlert('delete username');
                        if (offline) return;

                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                        const hexPub = npubToHex(npub);
                        const hexSec = nsecToHex(nsec);
                        if (!hexPub || !hexSec) {
                            toast.show('Error', { message: 'Could not decode keys', duration: 3000 });
                            return;
                        }

                        setIsDeleting(true);
                        try {
                            const namePart = nip05.split('@')[0];
                            const result = await unregisterUsername(namePart, hexPub, hexSec);
                            
                            if (result.ok) {
                                await setNip05(null);
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                toast.show('Username deleted successfully', { duration: 3000 });
                            } else {
                                // If the server returned an error (e.g. rate limit, or registry server issue),
                                // offer user option to just clear it locally.
                                Alert.alert(
                                    'Registry Deletion Failed',
                                    `Server error: ${result.error || 'Unknown error'}.\n\nDo you want to force-remove the username reference locally anyway?`,
                                    [
                                        { text: 'Cancel', style: 'cancel' },
                                        {
                                            text: 'Force Remove Locally',
                                            style: 'destructive',
                                            onPress: async () => {
                                                await setNip05(null);
                                                toast.show('Local reference removed', { duration: 2500 });
                                            }
                                        }
                                    ]
                                );
                            }
                        } catch (err: any) {
                            toast.show('Error', { message: err?.message || 'Deletion failed', duration: 3000 });
                        } finally {
                            setIsDeleting(false);
                        }
                    }
                }
            ]
        );
    };

    const handleEditStart = () => {
        if (!nip05) return;
        const currentName = nip05.split('@')[0];
        setOldUsername(currentName);
        setInput(currentName);
        setIsEditing(true);
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
        if (checkState === 'available') {
            if (isEditing && input.toLowerCase() === oldUsername.toLowerCase()) {
                return { text: 'This is your current username', color: '$blue10' };
            }
            return { text: `✓ ${input}@${DOMAIN} is available!`, color: '$green10' };
        }
        if (checkState === 'taken') return { text: `✗ ${input}@${DOMAIN} is already taken`, color: '$red10' };
        if (checkState === 'error') return { text: 'Could not check availability — try again', color: '$orange10' };
        return null;
    };

    const msg = checkMessage();

    return (
        <ScrollView bg="$background" showsVerticalScrollIndicator={false}>
            <YStack px="$4" pt="$4" pb="$12" gap="$6">

                {/* Processing Overlay loader */}
                {isDeleting && (
                    <YStack bg="rgba(0,0,0,0.4)" p="$4" rounded="$4" items="center" gap="$2">
                        <ActivityIndicator size="large" color="#FFD700" />
                        <Text color="white" fontWeight="600">Deleting from Nostr Relays...</Text>
                    </YStack>
                )}

                {/* Current identifier */}
                {nip05 && !isEditing ? (
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
                                    icon={<Edit3 size={16} color="$blue10" />}
                                    onPress={handleEditStart}
                                >
                                    <Text color="$blue10" fontWeight="600">Edit</Text>
                                </Button>
                                
                                <Separator vertical borderColor="$borderColor" opacity={0.5} />
                                
                                <Button
                                    flex={1}
                                    size="$4"
                                    chromeless
                                    icon={<Trash2 size={16} color="$red10" />}
                                    onPress={handleDelete}
                                >
                                    <Text color="$red10" fontWeight="600">Delete</Text>
                                </Button>
                            </XStack>
                        </YStack>
                    </YStack>
                ) : (
                    /* ─── Claim / Edit flow ──────────────────────────────────── */
                    <YStack gap="$5">
                        {/* Header */}
                        <YStack gap="$2">
                            <Text fontWeight="800" fontSize="$7">
                                {isEditing ? 'Change Nostr Address' : 'Get a Nostr Address'}
                            </Text>
                            <Text color="$gray10" fontSize="$3" lineHeight={20}>
                                {isEditing 
                                    ? 'Select a new username. The old mapping will be deleted automatically once successfully changed.'
                                    : `Claim a free username@${DOMAIN} identifier to let others find and verify you on Nostr.`}
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

                        {/* Claim / Update button */}
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
                            {isRegistering 
                                ? (isEditing ? 'Updating Username...' : 'Claiming Username...') 
                                : (isEditing ? 'Update Username' : 'Claim Username')}
                        </Button>

                        {/* Cancel Edit Button */}
                        {isEditing && (
                            <Button
                                size="$4"
                                chromeless
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setInput('');
                                    setCheckState('idle');
                                    setIsEditing(false);
                                }}
                            >
                                <Text color="$gray10" fontWeight="600">Cancel Edit</Text>
                            </Button>
                        )}

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
