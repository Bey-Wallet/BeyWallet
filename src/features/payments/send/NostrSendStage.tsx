/**
 * NostrSendStage
 *
 * When the user selects 'Nostr' send mode, this stage opens a bottom sheet
 * for searching Nostr profiles, resolving NIP-05 addresses, or pasting/scanning
 * npub and nprofile identifiers using the same lookup flow as People.
 * After selecting a recipient, shows the amount input with the recipient displayed.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { YStack, XStack, Text, Button, Input } from 'tamagui';
import { Search, ClipboardPaste, User, ArrowUpDown } from '@tamagui/lucide-icons';
import { NumericKeypad } from '~/shared/ui/NumericKeypad';
import { Spinner } from '~/shared/ui/Spinner';
import { useRouter } from 'expo-router';
import { DestinationInputRow } from '~/shared/ui/DestinationInputRow';
import AppBottomSheet, { AppBottomSheetRef } from '~/shared/ui/AppBottomSheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useWalletStore } from '~/state/walletStore';
import { useSettingsStore } from '~/state/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/api/bitcoinService';
import {
  currencyService,
  CurrencyCode,
  SUPPORTED_CURRENCIES,
} from '~/services/wallet/currencyService';
import { MintSelectorSheet } from '~/shared/ui/HomeMintSelector';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { selectSortedPeople, type Person, usePeopleStore } from '~/state/peopleStore';
import { MintBalanceRow } from '~/shared/ui/MintBalanceRow';
import { BouncyAmount } from '~/shared/ui/BouncyAmount';
import {
  decodeNostrPublicKey,
  nostrProfileService,
  type NostrProfile,
} from '~/services/api/nostrProfileService';
import { useNostrProfileSearch } from '~/features/people/hooks/useNostrProfileSearch';
import { NostrProfileItem } from '~/features/people/components/NostrProfileItem';
import {
  getNostrRecipientLabel,
  isExactNostrRecipientQuery,
  isResolvedNostrRecipient,
} from '~/features/payments/send/nostrRecipient';

function personToProfile(person: Person): NostrProfile | null {
  const pubkeyHex = decodeNostrPublicKey(person.npub);
  if (!pubkeyHex) return null;
  return {
    pubkeyHex,
    npub: person.npub,
    name: person.username || undefined,
    displayName: person.displayName || undefined,
    nip05: person.nip05 || undefined,
    nip05Verified: person.nip05Verified,
    picture: person.picture || undefined,
    about: person.about || undefined,
    source: 'identifier',
  };
}

function profileMatches(profile: NostrProfile, query: string): boolean {
  return [profile.displayName, profile.name, profile.nip05, profile.npub]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(query.trim().toLowerCase());
}

function mergeProfiles(local: NostrProfile[], remote: NostrProfile[]): NostrProfile[] {
  const byPubkey = new Map<string, NostrProfile>();
  for (const profile of [...local, ...remote]) {
    const current = byPubkey.get(profile.pubkeyHex);
    byPubkey.set(profile.pubkeyHex, current ? { ...current, ...profile } : profile);
  }
  return [...byPubkey.values()];
}

interface NostrSendStageProps {
  amount: string;
  setAmount: (val: string) => void;
  recipientNpub: string;
  recipientUsername: string;
  setRecipientNpub: (val: string) => void;
  setRecipientUsername: (val: string) => void;
  onContinue: () => void;
  balance: number;
  isLoading?: boolean;
  error?: string | null;
}

export function NostrSendStage({
  amount,
  setAmount,
  recipientNpub,
  recipientUsername,
  setRecipientNpub,
  setRecipientUsername,
  onContinue,
  balance,
  isLoading,
  error,
}: NostrSendStageProps) {
  const {
    activeMintUrl,
    mints,
    refreshMintList,
    isInitializing,
    isRefreshing,
    scannerResult,
    setScannerResult,
  } = useWalletStore();
  const { primaryCurrency, secondaryCurrency, showBitcoinSymbol } = useSettingsStore();
  const people = usePeopleStore((s) => s.people);
  const [inputMode, setInputMode] = useState<'SATS' | 'FIAT'>(primaryCurrency);
  const mintSheetRef = useRef<AppBottomSheetRef>(null);
  const contactSheetRef = useRef<AppBottomSheetRef>(null);
  const router = useRouter();

  const isLoadingMint = isInitializing || isRefreshing;
  const [search, setSearch] = useState('');
  const [isResolvingRecipient, setIsResolvingRecipient] = useState(false);
  const { results: remoteResults, isSearching, error: searchError } = useNostrProfileSearch(search);
  const savedProfiles = useMemo(
    () =>
      selectSortedPeople({ people } as any)
        .map(personToProfile)
        .filter((profile): profile is NostrProfile => !!profile),
    [people],
  );
  const favoriteProfiles = useMemo(
    () => savedProfiles.filter((profile) => people[profile.npub]?.isFavorite),
    [people, savedProfiles],
  );
  const otherProfiles = useMemo(
    () => savedProfiles.filter((profile) => !people[profile.npub]?.isFavorite),
    [people, savedProfiles],
  );
  const searchResults = useMemo(
    () =>
      search.trim()
        ? mergeProfiles(
            savedProfiles.filter((profile) => profileMatches(profile, search)),
            remoteResults,
          )
        : [],
    [remoteResults, savedProfiles, search],
  );
  const hasRecipient = isResolvedNostrRecipient(recipientNpub);

  const selectProfile = useCallback(
    (profile: NostrProfile) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setRecipientNpub(profile.npub);
      setRecipientUsername(getNostrRecipientLabel(profile));
      setSearch('');
      contactSheetRef.current?.dismiss();
    },
    [setRecipientNpub, setRecipientUsername],
  );

  const resolveExactRecipient = useCallback(
    async (value: string): Promise<boolean> => {
      const cleaned = value.trim().replace(/^nostr:/i, '');
      if (!isExactNostrRecipientQuery(cleaned)) return false;
      setIsResolvingRecipient(true);
      try {
        const [profile] = await nostrProfileService.search(cleaned);
        if (!profile) return false;
        selectProfile(profile);
        return true;
      } finally {
        setIsResolvingRecipient(false);
      }
    },
    [selectProfile],
  );

  // Check if we just returned from the scanner
  useEffect(() => {
    if (scannerResult) {
      const cleaned = scannerResult.trim().replace(/^nostr:/i, '');
      setSearch(cleaned);
      setScannerResult(null);
      void resolveExactRecipient(cleaned).then((resolved) => {
        if (!resolved) contactSheetRef.current?.present();
      });
    }
  }, [resolveExactRecipient, scannerResult, setScannerResult]);

  // Auto-open contact sheet if no recipient
  useEffect(() => {
    if (hasRecipient) return;
    const timeout = setTimeout(() => contactSheetRef.current?.present(), 300);
    return () => clearTimeout(timeout);
  }, [hasRecipient]);

  const handleSearchChange = (text: string) => {
    setSearch(text);
  };

  const handlePaste = async () => {
    const value = (await Clipboard.getStringAsync()).trim();
    if (!value) return;
    setSearch(value);
    contactSheetRef.current?.present();
    await resolveExactRecipient(value);
  };

  const handleOpenScanner = () => {
    router.push({
      pathname: '/(modals)/scanner',
      params: { returnTo: '/(modals)/send', scannerMode: 'nostr' },
    });
  };

  const clearRecipient = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRecipientNpub('');
    setRecipientUsername('');
    setSearch('');
    contactSheetRef.current?.present();
  };

  // ── Amount logic ──────────────────────────────────────────────

  const { data: btcData } = useQuery({
    queryKey: ['bitcoinPrice', secondaryCurrency],
    queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
    staleTime: 30000,
  });

  const currencySymbol = useMemo(
    () => SUPPORTED_CURRENCIES.find((c) => c.code === secondaryCurrency)?.symbol || '$',
    [secondaryCurrency],
  );

  const activeMint = useMemo(() => {
    if (!activeMintUrl) return null;
    const normalizeUrl = (url: string) => url.replace(/\/$/, '');
    return mints.find((m) => normalizeUrl(m.mintUrl) === normalizeUrl(activeMintUrl));
  }, [mints, activeMintUrl]);

  const displayName = useMemo(() => {
    if (!activeMintUrl) return 'Select Mint';
    if (activeMint?.nickname) return activeMint.nickname;
    if (activeMint?.name) return activeMint.name;
    return activeMintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }, [activeMint, activeMintUrl]);

  const parsedAmountSats = parseInt(amount, 10) || 0;
  const isOverBalance = parsedAmountSats > balance;

  const isInvalidRecipient = useMemo(() => {
    if (!recipientNpub.trim()) return false;
    return !isResolvedNostrRecipient(recipientNpub);
  }, [recipientNpub]);

  const isValidAmount =
    parsedAmountSats > 0 && !isOverBalance && hasRecipient && !isInvalidRecipient;

  const conversionValue = useMemo(() => {
    if (!btcData?.price) return '0';
    if (inputMode === 'SATS') {
      const sats = Number(amount) || 0;
      return currencyService.formatValue(
        currencyService.convertSatsToCurrency(sats, btcData.price),
        secondaryCurrency as CurrencyCode,
      );
    } else {
      return currencyService.formatSats(Number(amount) || 0);
    }
  }, [amount, btcData?.price, inputMode, secondaryCurrency]);

  const [localInputValue, setLocalInputValue] = useState(amount);

  useEffect(() => {
    if (inputMode === 'SATS') setLocalInputValue(amount);
  }, [amount, inputMode]);

  const onKeypadChange = (rawVal: string) => {
    let val = rawVal;

    if (val === '.') {
      val = '0.';
    }

    if (inputMode === 'SATS') {
      val = val.replace(/\./g, '');
    } else {
      const parts = val.split('.');
      if (parts.length > 2) {
        val = parts[0] + '.' + parts.slice(1).join('');
      }
      if (parts.length === 2 && parts[1].length > 2) {
        val = parts[0] + '.' + parts[1].slice(0, 2);
      }
    }

    if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
      val = val.replace(/^0+/, '');
      if (val === '') val = '0';
    }

    const maxLen = 11;
    if (val.length > maxLen) {
      val = val.slice(0, maxLen);
    }

    setLocalInputValue(val);

    if (inputMode === 'SATS') {
      setAmount(val);
    } else if (btcData?.price) {
      const sats = currencyService.convertCurrencyToSats(Number(val) || 0, btcData.price);
      setAmount(String(sats));
    }
  };

  const toggleMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (inputMode === 'SATS') {
      if (btcData?.price) {
        const fiat = currencyService.convertSatsToCurrency(Number(amount) || 0, btcData.price);
        setLocalInputValue(fiat > 0 ? fiat.toFixed(2) : '0');
      }
      setInputMode('FIAT');
    } else {
      setLocalInputValue(amount);
      setInputMode('SATS');
    }
  };

  const handleMax = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const maxSats = balance.toString();
    setAmount(maxSats);
    if (inputMode === 'SATS') setLocalInputValue(maxSats);
    else if (btcData?.price) {
      setLocalInputValue(currencyService.convertSatsToCurrency(balance, btcData.price).toFixed(2));
    }
  };

  const formattedDisplayValue = useMemo(() => {
    if (!localInputValue || localInputValue === '0') return '0';
    if (inputMode === 'SATS') {
      const num = Number(localInputValue);
      if (!isNaN(num)) {
        return num.toLocaleString('en-US');
      }
    } else {
      const parts = localInputValue.split('.');
      const integerPart = Number(parts[0]);
      if (!isNaN(integerPart)) {
        const formattedInt = integerPart.toLocaleString('en-US');
        return parts.length > 1 ? `${formattedInt}.${parts[1]}` : formattedInt;
      }
    }
    return localInputValue;
  }, [localInputValue, inputMode]);

  const dynamicFontSize = useMemo(() => {
    const len = formattedDisplayValue.length;
    if (len <= 6) return 44;
    if (len <= 8) return 38;
    if (len <= 10) return 32;
    if (len <= 13) return 26;
    return 20;
  }, [formattedDisplayValue]);

  return (
    <YStack flex={1} justify="space-between">
      <YStack gap="$1.5">
        <MintBalanceRow
          activeMint={activeMint}
          activeMintUrl={activeMintUrl || undefined}
          displayName={displayName}
          balance={balance}
          isLoadingMint={isLoadingMint}
          isSelector={true}
          onPress={() => {
            refreshMintList();
            mintSheetRef.current?.present();
          }}
          showMax={true}
          onMaxPress={handleMax}
          maxDisabled={balance === 0}
        />

        {/* Card Box Container matching AmountStage & P2PKAmountStage */}
        <YStack
          width="100%"
          bg="$gray3"
          rounded="$6"
          p="$3"
          py="$5"
          items="center"
          gap="$3"
          borderWidth={0}
        >
          {/* Amount Display Section */}
          <YStack items="center" justify="center" py="$3" gap="$2" width="100%">
            {error || isOverBalance ? (
              <Text color="$red10" fontSize="$3" fontWeight="600" text="center">
                {error || 'Exceeds available balance'}
              </Text>
            ) : (
              <Text color="$gray10" fontSize="$3" fontWeight="500">
                How much to send?
              </Text>
            )}

            <BouncyAmount
              value={formattedDisplayValue}
              fontSize={dynamicFontSize}
              prefix={inputMode === 'SATS' ? (showBitcoinSymbol ? '₿' : '') : currencySymbol}
              suffix={inputMode === 'SATS' && !showBitcoinSymbol ? ' SATS' : ''}
            />

            <Button
              size="$3"
              rounded="$10"
              bg="$gray5"
              pressStyle={{ scale: 0.96, bg: '$gray5' }}
              onPress={toggleMode}
              iconAfter={<ArrowUpDown size={14} color="$accent10" strokeWidth={2.5} />}
            >
              {conversionValue}
            </Button>
          </YStack>
        </YStack>

        {/* Recipient display / selector bar */}
        <DestinationInputRow
          value={recipientUsername || recipientNpub}
          onChangeText={(val) => {
            if (val === '') {
              clearRecipient();
            } else {
              setRecipientNpub('');
              setRecipientUsername(val);
              setSearch(val);
              contactSheetRef.current?.present();
            }
          }}
          placeholder="NIP-05, name, npub, or nprofile"
          onPaste={handlePaste}
          onScan={handleOpenScanner}
          defaultIcon={<User size="$1.5" color="$accent5" strokeWidth={2.5} />}
          onIconPress={() => contactSheetRef.current?.present()}
          isError={isInvalidRecipient}
        />
      </YStack>

      <NumericKeypad
        showAmountDisplay={false}
        value={localInputValue}
        onValueChange={onKeypadChange}
        onConfirm={onContinue}
        confirmLabel={isLoading ? 'Processing...' : 'Continue'}
        confirmDisabled={!isValidAmount || isLoading}
        confirmIcon={isLoading ? <Spinner size="small" /> : undefined}
      />

      {/* ── Contact Search Sheet ──────────────────────────────────── */}
      <AppBottomSheet ref={contactSheetRef} snapPoints={['70%', '90%']}>
        <YStack p="$4" gap="$3" flex={1}>
          <Text fontSize="$6" fontWeight="800" color="$accent5" style={{ textAlign: 'center' }}>
            Send to
          </Text>

          <XStack width="100%" bg="$gray4" rounded="$4" px="$3" height={50} items="center" gap="$2">
            <Search size={20} color="$gray10" />
            <Input
              flex={1}
              borderWidth={0}
              bg="transparent"
              placeholder="Name, NIP-05, npub, or nprofile"
              value={search}
              onChangeText={handleSearchChange}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {isSearching || isResolvingRecipient ? (
              <Spinner size="small" />
            ) : (
              <Button
                size="$2"
                chromeless
                icon={<ClipboardPaste size={18} />}
                onPress={handlePaste}
              />
            )}
          </XStack>

          <BottomSheetScrollView showsVerticalScrollIndicator={false}>
            <YStack gap="$2" pb="$4">
              {search.trim() ? (
                searchResults.map((profile, index) => (
                  <NostrProfileItem
                    key={profile.pubkeyHex}
                    profile={profile}
                    isFavorite={people[profile.npub]?.isFavorite}
                    onPress={selectProfile}
                    onSend={selectProfile}
                    showTopSeparator={index === 0}
                  />
                ))
              ) : (
                <>
                  {favoriteProfiles.length > 0 && (
                    <YStack gap="$1">
                      <Text fontSize="$3" fontWeight="700" color="$gray10" px="$1">
                        Favorites
                      </Text>
                      {favoriteProfiles.map((profile, index) => (
                        <NostrProfileItem
                          key={profile.pubkeyHex}
                          profile={profile}
                          isFavorite
                          onPress={selectProfile}
                          onSend={selectProfile}
                          showTopSeparator={index === 0}
                        />
                      ))}
                    </YStack>
                  )}

                  {otherProfiles.length > 0 && (
                    <YStack mt="$3" gap="$1">
                      <Text fontSize="$3" fontWeight="700" color="$gray10" px="$1">
                        People
                      </Text>
                      {otherProfiles.map((profile, index) => (
                        <NostrProfileItem
                          key={profile.pubkeyHex}
                          profile={profile}
                          isFavorite={people[profile.npub]?.isFavorite}
                          onPress={selectProfile}
                          onSend={selectProfile}
                          showTopSeparator={index === 0}
                        />
                      ))}
                    </YStack>
                  )}
                </>
              )}

              {search.trim() && !isSearching && !searchResults.length && (
                <YStack mt="$3" gap="$2">
                  <Text color="$gray10" style={{ textAlign: 'center' }}>
                    {searchError || 'No people found'}
                  </Text>
                </YStack>
              )}
            </YStack>
          </BottomSheetScrollView>
        </YStack>
      </AppBottomSheet>

      {/* ── Mint Selector Sheet ──────────────────────────────────── */}
      <MintSelectorSheet ref={mintSheetRef} />
    </YStack>
  );
}
