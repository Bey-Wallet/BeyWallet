import { AppInput as Input } from '~/shared/ui/AppInput';
import React, { useDeferredValue, useMemo, useState } from 'react';
import { Alert, FlatList } from 'react-native';
import { Check, UserRound, UserRoundCheck } from '@tamagui/lucide-icons';
import { getTokens, Text, XStack, YStack, useTheme } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePeopleStore, type Person } from '~/state/peopleStore';
import { AppButton } from '~/shared/ui/AppButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import { SettingsDescription, SettingsMessage } from './components/SettingsLayout';

const label = (person: Person) =>
  person.displayName || person.username || person.nip05 || person.npub;

export function BlockedPeopleSettingsScreen() {
  const people = usePeopleStore((state) => state.people);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const search = useDeferredValue(query.trim().toLowerCase());
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const blocked = useMemo(
    () =>
      Object.values(people)
        .filter((person) => person.contactStatus === 'blocked')
        .sort((a, b) => label(a).localeCompare(label(b)) || a.npub.localeCompare(b.npub)),
    [people],
  );
  const matches = useMemo(
    () =>
      blocked.filter((person) =>
        [person.displayName, person.username, person.nip05, person.npub].some((value) =>
          value?.toLowerCase().includes(search),
        ),
      ),
    [blocked, search],
  );
  const selected = blocked.filter((person) => selection.has(person.npub));
  const allVisibleSelected =
    matches.length > 0 && matches.every((person) => selection.has(person.npub));
  const toggle = (npub: string) =>
    setSelection((current) => {
      const next = new Set(current);
      if (next.has(npub)) next.delete(npub);
      else next.add(npub);
      return next;
    });
  const unblock = () => {
    if (!selected.length) return;
    const targets = selected.map((person) => person.npub);
    const targetSet = new Set(targets);
    Alert.alert(
      targets.length === 1
        ? `Unblock ${label(selected[0])}?`
        : `Unblock ${targets.length} contacts?`,
      'These contacts will return to an unaccepted state. You can review and accept them again in People.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: () => {
            usePeopleStore.getState().unblockPeople(targets);
            setSelection((current) => new Set([...current].filter((npub) => !targetSet.has(npub))));
          },
        },
      ],
    );
  };
  return (
    <YStack flex={1} bg="$background" p="$4" gap="$3" pb={Math.max(insets.bottom, 16)}>
      <SettingsDescription>
        Select contacts to unblock. They will need to be accepted again before you can chat.
      </SettingsDescription>
      {blocked.length > 0 && (
        <>
          <Input
            accessibilityLabel="Search blocked contacts"
            placeholder="Search name, username or public key"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            rounded="$6"
            color="$color"
          />
          <XStack items="center" justify="space-between" gap="$2">
            <Text color="$gray10" fontSize="$3" flex={1}>
              {search ? `${matches.length} of ${blocked.length}` : `${blocked.length} blocked`}
            </Text>
            <AppButton
              size="xsmall"
              variant="default"
              emphasis="text"
              disabled={!matches.length}
              onPress={() =>
                setSelection((current) => {
                  const next = new Set(current);
                  for (const person of matches) {
                    if (allVisibleSelected) next.delete(person.npub);
                    else next.add(person.npub);
                  }
                  return next;
                })
              }
            >
              {allVisibleSelected ? 'Deselect results' : search ? 'Select results' : 'Select all'}
            </AppButton>
            {selected.length > 0 && (
              <AppButton
                size="xsmall"
                variant="default"
                emphasis="text"
                onPress={() => setSelection(new Set())}
              >
                Clear
              </AppButton>
            )}
          </XStack>
        </>
      )}
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{
          backgroundColor: theme.buttonDefaultSecondary?.val,
          borderRadius: getTokens().radius.$6.val,
          overflow: 'hidden',
        }}
        data={matches}
        extraData={selection}
        keyExtractor={(person) => person.npub}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={15}
        maxToRenderPerBatch={12}
        windowSize={7}
        ItemSeparatorComponent={() => <YStack height={2} width="100%" bg="$background" />}
        ListEmptyComponent={
          <SettingsMessage>
            {blocked.length ? 'No matching blocked contacts.' : 'No blocked contacts.'}
          </SettingsMessage>
        }
        renderItem={({ item }) => (
          <AppPressable
            accessibilityRole="checkbox"
            accessibilityLabel={label(item)}
            accessibilityState={{ checked: selection.has(item.npub) }}
            onPress={() => toggle(item.npub)}
            minHeight={64}
            px="$4"
            py="$3"
            flexDirection="row"
            items="center"
            gap="$3"
            pressStyle={{ bg: '$buttonDefaultSecondaryPress' }}
            hoverStyle={{ bg: '$buttonDefaultSecondaryHover' }}
          >
            <UserRound size={20} color="$color" />
            <YStack flex={1} gap="$1">
              <Text fontSize="$5" color="$color" fontWeight="500" numberOfLines={1}>
                {label(item)}
              </Text>
              <Text fontSize="$3" color="$gray10" numberOfLines={1}>
                {item.nip05 || `${item.npub.slice(0, 12)}…${item.npub.slice(-8)}`}
              </Text>
            </YStack>
            <YStack
              width={22}
              height={22}
              rounded="$2"
              borderWidth={1}
              borderColor={selection.has(item.npub) ? '$blue10' : '$gray10'}
              items="center"
              justify="center"
            >
              {selection.has(item.npub) && <Check size={16} color="$blue10" />}
            </YStack>
          </AppPressable>
        )}
      />
      {blocked.length > 0 && (
        <AppButton icon={UserRoundCheck} disabled={!selected.length} onPress={unblock}>
          {selected.length ? `Unblock selected (${selected.length})` : 'Select contacts to unblock'}
        </AppButton>
      )}
    </YStack>
  );
}
