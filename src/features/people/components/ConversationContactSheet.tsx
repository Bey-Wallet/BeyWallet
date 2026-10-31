import React, { forwardRef, useState } from 'react';
import { Alert, Share } from 'react-native';
import * as Linking from 'expo-linking';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Info, RefreshCw, Share2, Trash2, UserX } from '@tamagui/lucide-icons';
import { Text, XStack, YStack } from 'tamagui';
import AppBottomSheet, { type AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { ListTable, ListTableRow } from '~/shared/ui/ListTable';
import { Spinner } from '~/shared/ui/Spinner';
import { usePeopleStore } from '~/state/peopleStore';
import Nip05VerifiedBadge from '~/shared/icons/Nip05VerifiedBadge';
import { ConversationAvatar } from './ConversationAvatar';
import { syncConversationContact } from '../syncConversationContact';
import { hasVerifiedNip05 } from '../nip05';
import { useAppToast } from '~/shared/hooks/useAppToast';
import { interactionCopy } from '~/services/feedback/interactionCopy';

export const ConversationContactSheet = forwardRef<
  AppBottomSheetRef,
  { npub: string; label: string; bottomInset: number }
>(function ConversationContactSheet({ npub, label, bottomInset }, ref) {
  const toast = useAppToast();
  const person = usePeopleStore((state) => state.people[npub]);
  const [feedback, setFeedback] = useState('');
  const [syncing, setSyncing] = useState(false);
  const address = person?.nip05 || (person?.username?.includes('@') ? person.username : undefined);
  const copy = async () => {
    await toast.copy(npub);
  };
  const share = async () => {
    const url = Linking.createURL('/(modals)/conversation', { queryParams: { npub } });
    try {
      await Share.share({ message: `${address || label}\n${npub}\n${url}` });
    } catch {
      toast.showFeedback(interactionCopy.shareFailed);
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
              {person && hasVerifiedNip05(person) && <Nip05VerifiedBadge />}
            </XStack>
            {address && label !== address && <Text color="$gray10">{label}</Text>}
          </YStack>
          <ListTable>
            <ListTableRow
              label={npub}
              labelColor="$color"
              multiline
              isCopyable
              onCopy={() => void copy()}
              onPress={() => void copy()}
            />
            <ListTableRow label="Share contact" icon={Share2} onPress={() => void share()} />
            <ListTableRow
              label="Messaging"
              icon={Info}
              value={person?.chatTransport === 'nip04' ? 'Legacy (NIP-04)' : 'NIP-17'}
              onPress={() =>
                Alert.alert(
                  'Messaging format',
                  'NIP-17 is the default and hides who sent the message. Legacy NIP-04 works with older clients such as Primal. It encrypts the text, but sender, recipient and timestamp are public. This choice applies to new messages in this conversation.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Use NIP-17',
                      onPress: () =>
                        usePeopleStore.getState().savePerson({ npub, chatTransport: 'nip17' }),
                    },
                    {
                      text: 'Use legacy NIP-04',
                      onPress: () =>
                        usePeopleStore.getState().savePerson({ npub, chatTransport: 'nip04' }),
                    },
                  ],
                )
              }
            />
            <ListTableRow
              label={syncing ? 'Checking contact…' : 'Check and sync'}
              icon={RefreshCw}
              disabled={syncing}
              rightContent={syncing ? <Spinner size="small" /> : undefined}
              onPress={() => void sync()}
            />
            <ListTableRow
              label="Delete contact"
              icon={Trash2}
              iconColor="$red10"
              labelColor="$red10"
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
            />
            <ListTableRow
              label="Block contact"
              icon={UserX}
              iconColor="$red10"
              labelColor="$red10"
              disabled={person?.contactStatus === 'blocked'}
              onPress={() =>
                Alert.alert(
                  'Block contact?',
                  'Waiting payments remain unclaimed. Unblock this person in Settings → Security & privacy → Blocked people.',
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
            />
          </ListTable>
          {!!feedback && (
            <Text accessibilityLiveRegion="polite" color="$gray11">
              {feedback}
            </Text>
          )}
        </YStack>
      </BottomSheetScrollView>
    </AppBottomSheet>
  );
});
