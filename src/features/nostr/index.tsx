import { AppInput as Input } from '~/shared/ui/AppInput';
import { interactionCopy } from '~/services/feedback/interactionCopy';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
import { SettingsPage, SettingsDescription } from '~/features/settings/components/SettingsLayout';
import { useSettingsBusy } from '~/features/settings/hooks/useSettingsBusy';
import { useNip05Lookup } from '~/shared/hooks/useNip05Lookup';
import Nip05VerifiedBadge from '~/shared/icons/Nip05VerifiedBadge';
import { Spinner } from '~/shared/ui/Spinner';
import { AppButton } from '~/shared/ui/AppButton';
import React, { useState, useEffect, useRef } from 'react';
import { YStack, XStack, Text } from 'tamagui';
import { Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { networkService } from '~/services/platform/networkService';
import { AtSign, CheckCircle, XCircle, Copy, Trash2, Edit3 } from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';

import { useAppToast } from '~/shared/hooks/useAppToast';
import { useSettingsStore } from '~/state/settingsStore';
import { nip19 } from 'nostr-tools';
import { finalizeEvent } from 'nostr-tools/pure';
import { Buffer } from 'buffer';
import { nostrIdentityService } from '~/services/wallet/nostrIdentityService';

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
    const res = await fetch(`${API_BASE}/register?check=${encodeURIComponent(username)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return 'error';
    const data = await res.json();
    if (data?.available === true) return 'available';
    if (data?.available === false) return 'taken';
    return 'error';
  } catch {
    return 'error';
  }
}

/** Unregister username on bey.cash using signed proof event */
async function unregisterUsername(
  username: string,
  hexPubkey: string,
  hexPrivkey: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const privkeyBytes = hexToBytes(hexPrivkey);
    const proofEvent = finalizeEvent(
      {
        kind: 22242,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({
          username: username.toLowerCase(),
          domain: DOMAIN,
          action: 'register',
        }),
      },
      privkeyBytes,
    );

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

export function NostrUsernameScreen({ settingsMode = false }: { settingsMode?: boolean }) {
  const { claim } = useLocalSearchParams<{ claim?: string }>();
  const [claimFromShortcut, setClaimFromShortcut] = useState(claim === '1');
  const toast = useAppToast();
  const router = useRouter();
  const { npub, nsec, nip05, setNip05 } = useSettingsStore();

  const [input, setInput] = useState('');
  const [checkState, setCheckState] = useState<CheckState>('idle');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  useSettingsBusy(isRegistering || isDeleting);
  const lookup = useNip05Lookup();

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

    let cancelled = false;
    setCheckState('checking');
    debounceRef.current = setTimeout(async () => {
      const offline = await networkService.isOffline();
      if (offline) {
        if (!cancelled) setCheckState('error');
        return;
      }
      const result = await checkAvailability(input);
      if (!cancelled) setCheckState(result);
    }, 500);
    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input, isEditing, oldUsername]);

  const handleClaim = async () => {
    if (!npub || !nsec) {
      toast.showFeedback(interactionCopy.missingKeysPleaseReauthenticate);
      return;
    }

    if (checkState !== 'available') return;

    const offline = await networkService.checkOfflineAndAlert('claim username');
    if (offline) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const hexPub = npubToHex(npub);
    const hexSec = nsecToHex(nsec);
    if (!hexPub || !hexSec) {
      toast.showFeedback(interactionCopy.couldNotDecodeKeys);
      return;
    }

    setIsRegistering(true);
    try {
      const result = await nostrIdentityService.registerUsername(input, hexPub, hexSec);
      if (result.ok) {
        const identifier = result.nip05!;
        let oldUsernameReleaseError: string | undefined;

        // Preserve the current identity until the replacement is confirmed registered.
        if (isEditing && oldUsername && oldUsername.toLowerCase() !== input.toLowerCase()) {
          console.log(`[NostrUsername] Releasing old username: ${oldUsername}`);
          const deleteResult = await unregisterUsername(oldUsername, hexPub, hexSec);
          if (!deleteResult.ok) {
            oldUsernameReleaseError = deleteResult.error || 'Unknown registry error';
          }
        }

        await setNip05(identifier);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const copy = oldUsernameReleaseError
          ? interactionCopy.usernameNeedsReview
          : result.profilePublished
            ? interactionCopy.usernameSaved
            : interactionCopy.usernameProfilePending;
        toast.showFeedback(copy);
        setInput('');
        setCheckState('idle');
        setIsEditing(false);
        setClaimFromShortcut(false);
        void lookup.refresh();
        if (!settingsMode)
          setTimeout(() => {
            router.back();
          }, 1500);
      } else {
        toast.showFeedback(interactionCopy.couldNotRegisterThisUsernamePleaseTry);
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
              toast.showFeedback(interactionCopy.couldNotDecodeKeys);
              return;
            }

            setIsDeleting(true);
            try {
              const namePart = nip05.split('@')[0];
              const result = await unregisterUsername(namePart, hexPub, hexSec);

              if (result.ok) {
                await setNip05(null);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                toast.showFeedback(interactionCopy.usernameDeleted);
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
                        toast.showFeedback(interactionCopy.localReferenceRemoved);
                      },
                    },
                  ],
                );
              }
            } catch (err: any) {
              toast.showFeedback(interactionCopy.couldNotDeleteThisUsernamePleaseTry);
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
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
    if (!(await copyWithFeedback(nip05, toast))) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.showFeedback(interactionCopy.copiedToClipboard);
  };

  // ─── Check icon ─────────────────────────────────────────────────────────
  const CheckIcon = () => {
    if (!input || !isValidFormat) return null;
    if (checkState === 'checking') return <Spinner size="small" color="#888" />;
    if (checkState === 'available') return <CheckCircle size={20} color="$green10" />;
    if (checkState === 'taken') return <XCircle size={20} color="$red10" />;
    return null;
  };

  const checkMessage = () => {
    if (!input) return null;
    if (!isValidFormat)
      return { text: 'Only lowercase letters, numbers, _ . - allowed', color: '$orange10' };
    if (checkState === 'checking') return { text: 'Checking availability…', color: '$gray10' };
    if (checkState === 'available') {
      if (isEditing && input.toLowerCase() === oldUsername.toLowerCase()) {
        return { text: 'This is your current username', color: '$blue10' };
      }
      return { text: `✓ ${input}@${DOMAIN} is available!`, color: '$green10' };
    }
    if (checkState === 'taken')
      return { text: `✗ ${input}@${DOMAIN} is already taken`, color: '$red10' };
    if (checkState === 'error')
      return { text: 'Could not check availability — try again', color: '$orange10' };
    return null;
  };

  const msg = checkMessage();

  return (
    <SettingsPage>
      <SettingsDescription>
        {isEditing
          ? 'Choose a new address. Your current address stays active until the replacement is registered.'
          : 'A free @bey.cash username helps people find you and verify your Nostr identity.'}
      </SettingsDescription>
      {nip05 && !isEditing && !claimFromShortcut ? (
        <>
          <YStack gap="$2">
            <XStack items="center" gap="$2">
              <Text fontSize="$5" fontWeight="500" color="$color" flexShrink={1}>
                {nip05}
              </Text>
              {lookup.status === 'verified' && lookup.nip05 === nip05 && (
                <Nip05VerifiedBadge size={18} />
              )}
            </XStack>
            <Text fontSize="$3" color="$gray10">
              {lookup.status === 'verified'
                ? 'Username verified'
                : lookup.loading
                  ? 'Checking username…'
                  : 'Saved username'}
            </Text>
          </YStack>
          <AppButton
            icon={Copy}
            variant="default"
            emphasis="secondary"
            disabled={isDeleting}
            onPress={handleCopyIdentifier}
          >
            Copy address
          </AppButton>
          <AppButton icon={Edit3} disabled={isDeleting} onPress={handleEditStart}>
            Change username
          </AppButton>
          <AppButton
            icon={Trash2}
            variant="critical"
            emphasis="secondary"
            loading={isDeleting}
            onPress={handleDelete}
          >
            Delete username
          </AppButton>
        </>
      ) : (
        <>
          <YStack gap="$3">
            <Text fontSize="$5" color="$color" fontWeight="500">
              Choose a username
            </Text>
            <XStack items="center" gap="$2">
              <Input
                flex={1}
                accessibilityLabel="Nostr username"
                placeholder="yourname"
                value={input}
                onChangeText={(value) => setInput(value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                autoCapitalize="none"
                autoCorrect={false}
                rounded="$6"
                editable={!isRegistering}
                color="$color"
              />
              <Text fontSize="$3" color="$gray10">
                @{DOMAIN}
              </Text>
              <CheckIcon />
            </XStack>
            {msg && (
              <Text fontSize="$3" color={msg.color as any} accessibilityLiveRegion="polite">
                {msg.text}
              </Text>
            )}
          </YStack>
          <AppButton
            icon={AtSign}
            loading={isRegistering}
            loadingText={isEditing ? 'Updating username…' : 'Claiming username…'}
            disabled={checkState !== 'available' || isRegistering}
            onPress={handleClaim}
          >
            {isEditing ? 'Update username' : 'Claim username'}
          </AppButton>
          {isEditing && (
            <AppButton
              variant="default"
              emphasis="secondary"
              disabled={isRegistering}
              onPress={() => {
                setInput('');
                setCheckState('idle');
                setIsEditing(false);
              }}
            >
              Cancel
            </AppButton>
          )}
          <SettingsDescription>
            Your username is public. Your private keys stay on this device.
          </SettingsDescription>
        </>
      )}
    </SettingsPage>
  );
}
