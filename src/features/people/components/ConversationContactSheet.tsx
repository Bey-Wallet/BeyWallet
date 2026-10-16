import React, { forwardRef, useState } from 'react';
import { Alert, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Copy, RefreshCw, Share2, Trash2, UserX } from '@tamagui/lucide-icons';
import { Text, XStack, YStack } from 'tamagui';
import AppBottomSheet, { type AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { AppButton } from '~/shared/ui/AppButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import { usePeopleStore } from '~/state/peopleStore';
import Nip05VerifiedBadge from '~/shared/icons/Nip05VerifiedBadge';
import { ConversationAvatar } from './ConversationAvatar';
import { syncConversationContact } from '../syncConversationContact';

export const ConversationContactSheet = forwardRef<
  AppBottomSheetRef,
  { npub: string; label: string; bottomInset: number }
>(function ConversationContactSheet({ npub, label, bottomInset }, ref) {
  const person = usePeopleStore((state) => state.people[npub]);
  const [feedback, setFeedback] = useState('');
  const [syncing, setSyncing] = useState(false);
  const address = person?.nip05 || (person?.username?.includes('@') ? person.username : undefined);
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(npub);
      setFeedback('Public key copied');
    } catch {
      setFeedback('Could not copy this public key. Try again.');
    }
  };
  const share = async () => {
    const url = Linking.createURL('/(modals)/conversation', { queryParams: { npub } });
    try {
      await Share.share({ message: `${address || label}\n${npub}\n${url}` });
    } catch {
      setFeedback('Could not share this contact. Try again.');
    }
  };
  const sync = async () => {
    if (syncing) return;
    setSyncing(true);
    setFeedback('');
    try {
      setFeedback(await syncConversationContact(npub));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Could not sync this contact.');
    } finally {
      setSyncing(false);
    }
  };
  return (
    <AppBottomSheet ref={ref} snapPoints={['75%']} bottomInset={bottomInset}>
      <BottomSheetScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: Math.max(bottomInset, 20) + 12 }}
      >
        <YStack gap="$4">
          <YStack items="center" gap="$3">
            <ConversationAvatar npub={npub} picture={person?.picture} size={112} />
            <XStack items="center" justify="center" gap="$2" flexWrap="wrap">
              <Text fontSize="$6" fontWeight="800" textAlign="center">
                {address || label}
              </Text>
              {person?.nip05Verified && <Nip05VerifiedBadge />}
            </XStack>
            {address && label !== address && <Text color="$gray10">{label}</Text>}
          </YStack>
          <AppPressable
            accessibilityLabel="Copy public key"
            minHeight={48}
            bg="$buttonDefaultSecondary"
            p="$3"
            rounded="$4"
            onPress={() => void copy()}
          >
            <Text fontFamily="$mono" fontSize="$2" color="$buttonDefaultSecondaryText">
              {npub}
            </Text>
          </AppPressable>
          {!!feedback && (
            <Text accessibilityLiveRegion="polite" color="$gray11">
              {feedback}
            </Text>
          )}
          <XStack gap="$2">
            <AppButton
              variant="default"
              emphasis="secondary"
              flex={1}
              icon={Copy}
              onPress={() => void copy()}
            >
              Copy npub
            </AppButton>
            <AppButton
              variant="default"
              emphasis="secondary"
              flex={1}
              icon={Share2}
              onPress={() => void share()}
            >
              Share contact
            </AppButton>
          </XStack>
          <AppButton
            variant="default"
            emphasis="secondary"
            icon={RefreshCw}
            loading={syncing}
            loadingText="Checking contact…"
            onPress={() => void sync()}
          >
            Check and sync
          </AppButton>
          <AppButton
            variant="critical"
            emphasis="secondary"
            icon={Trash2}
            disabled={person?.contactStatus !== 'accepted'}
            onPress={() =>
              Alert.alert(
                'Delete contact?',
                'Remove this person from your accepted contacts. Messages and payment history stay. Accept them again to receive payments.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete contact',
                    style: 'destructive',
                    onPress: () => {
                      usePeopleStore.getState().savePerson({
                        npub,
                        contactStatus: 'unaccepted',
                        requiresAcceptance: true,
                      });
                      setFeedback('Contact removed. Conversation history kept.');
                    },
                  },
                ],
              )
            }
          >
            Delete contact
          </AppButton>
          <AppButton
            variant="critical"
            emphasis="secondary"
            icon={UserX}
            disabled={person?.contactStatus === 'blocked'}
            onPress={() =>
              Alert.alert(
                'Block contact?',
                'Waiting payments remain unclaimed. Unblock this person in Nostr Settings.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Block contact',
                    style: 'destructive',
                    onPress: () => {
                      usePeopleStore.getState().setContactStatus(npub, 'blocked');
                      setFeedback('Contact blocked');
                    },
                  },
                ],
              )
            }
          >
            Block contact
          </AppButton>
        </YStack>
      </BottomSheetScrollView>
    </AppBottomSheet>
  );
});
