/**
 * NostrSendStage
 *
 * When the user selects 'Nostr' send mode, this stage opens a bottom sheet
 * for searching bey.cash usernames or pasting/scanning npubs (like contact-search).
 * After selecting a recipient, shows the amount input with the recipient displayed.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { YStack, XStack, Text, H1, Button, Input, View, Avatar, Square } from 'tamagui';
import {
    Search, ClipboardPaste, ChevronDown, Sprout, User, X, Wallet, ArrowUpDown
} from '@tamagui/lucide-icons';
import { NumericKeypad } from '~/components/UI/NumericKeypad';
import { Spinner } from '~/components/UI/Spinner';
import Blockies from '~/components/UI/Blockies';
import AppBottomSheet, { AppBottomSheetRef } from '~/components/UI/AppBottomSheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useWalletStore } from '~/store/walletStore';
import { useSettingsStore } from '~/store/settingsStore';
import { useQuery } from '@tanstack/react-query';
import { bitcoinService } from '~/services/bitcoinService';
import { currencyService, CurrencyCode, SUPPORTED_CURRENCIES } from '~/services/currencyService';
import { nip19 } from 'nostr-tools';
import { MintSelectorSheet } from '~/components/HomeMintSelector';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Buffer } from 'buffer';
import { useContactsStore } from '~/store/contactsStore';

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
    amount, setAmount, recipientNpub, recipientUsername,
    setRecipientNpub, setRecipientUsername,
    onContinue, balance, isLoading, error
}: NostrSendStageProps) {
    const { activeMintUrl, mints, refreshMintList, isInitializing, isRefreshing } = useWalletStore();
    const { primaryCurrency, secondaryCurrency } = useSettingsStore();
    const favorites = useContactsStore(s => s.favorites);
    const favoriteContacts = Object.values(favorites);
    const [inputMode, setInputMode] = useState<'SATS' | 'FIAT'>(primaryCurrency);
    const mintSheetRef = useRef<AppBottomSheetRef>(null);
    const contactSheetRef = useRef<AppBottomSheetRef>(null);

    const isLoadingMint = isInitializing || isRefreshing;
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [directory, setDirectory] = useState<Record<string, string>>({});
    const [hasRecipient, setHasRecipient] = useState(!!recipientNpub);

    // Fetch bey.cash directory
    useEffect(() => {
        const fetchDirectory = async () => {
            try {
                const res = await fetch(`https://bey.cash/.well-known/nostr.json?_t=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data?.names) setDirectory(data.names);
                }
            } catch { /* silent */ }
        };
        fetchDirectory();
    }, []);

    // Auto-open contact sheet if no recipient
    useEffect(() => {
        if (!recipientNpub) {
            setTimeout(() => contactSheetRef.current?.present(), 300);
        } else {
            setHasRecipient(true);
        }
    }, [recipientNpub]);

    const doSearch = (query: string, dict: Record<string, string> = directory) => {
        if (!query) { setResults([]); return; }
        const lowerQuery = query.toLowerCase().trim();
        const found: any[] = [];

        if (lowerQuery.startsWith('npub1')) {
            try {
                const decoded = nip19.decode(lowerQuery);
                if (decoded.type === 'npub') {
                    let hex = '';
                    const data = decoded.data as unknown;
                    if (typeof data === 'string') hex = data.toLowerCase();
                    else if (data instanceof Uint8Array) hex = Buffer.from(data).toString('hex');

                    let username = null;
                    for (const [name, pubkey] of Object.entries(dict)) {
                        if (pubkey.toLowerCase() === hex) { username = name; break; }
                    }
                    found.push({ npub: lowerQuery, username, hex });
                }
            } catch { /* invalid npub */ }
        } else {
            for (const [name, pubkey] of Object.entries(dict)) {
                if (name.toLowerCase().includes(lowerQuery)) {
                    try {
                        const npub = nip19.npubEncode(pubkey);
                        found.push({ npub, username: name, hex: pubkey });
                    } catch { /* ignore */ }
                }
            }
        }
        setResults(found);
    };

    const handleSearchChange = (text: string) => {
        setSearch(text);
        doSearch(text);
    };

    const handlePaste = async () => {
        const text = await Clipboard.getStringAsync();
        if (text) { setSearch(text); doSearch(text, directory); }
    };

    const selectContact = (contact: any) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setRecipientNpub(contact.npub);
        setRecipientUsername(contact.username ? `${contact.username}@bey.cash` : '');
        setHasRecipient(true);
        contactSheetRef.current?.dismiss();
    };

    const clearRecipient = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setRecipientNpub('');
        setRecipientUsername('');
        setHasRecipient(false);
        setSearch('');
        setResults([]);
        contactSheetRef.current?.present();
    };

    const formatNpub = (str: string | null) => {
        if (!str) return '';
        if (str.length < 20) return str;
        return `${str.slice(0, 10)}...${str.slice(-6)}`;
    };

    // ── Amount logic ──────────────────────────────────────────────

    const { data: btcData } = useQuery({
        queryKey: ['bitcoinPrice', secondaryCurrency],
        queryFn: () => bitcoinService.fetchPrice(secondaryCurrency),
        staleTime: 30000,
    });

    const currencySymbol = useMemo(() =>
        SUPPORTED_CURRENCIES.find(c => c.code === secondaryCurrency)?.symbol || '$',
        [secondaryCurrency]
    );

    const activeMint = useMemo(() => {
        if (!activeMintUrl) return null;
        const normalizeUrl = (url: string) => url.replace(/\/$/, "");
        return mints.find(m => normalizeUrl(m.mintUrl) === normalizeUrl(activeMintUrl));
    }, [mints, activeMintUrl]);

    const displayName = useMemo(() => {
        if (!activeMintUrl) return "Select Mint";
        if (activeMint?.nickname) return activeMint.nickname;
        if (activeMint?.name) return activeMint.name;
        return activeMintUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    }, [activeMint, activeMintUrl]);

    const parsedAmountSats = parseInt(amount, 10) || 0;
    const isOverBalance = parsedAmountSats > balance;
    const isValidAmount = parsedAmountSats > 0 && !isOverBalance && hasRecipient;

    const conversionValue = useMemo(() => {
        if (!btcData?.price) return '0';
        if (inputMode === 'SATS') {
            const sats = Number(amount) || 0;
            return currencyService.formatValue(
                currencyService.convertSatsToCurrency(sats, btcData.price),
                secondaryCurrency as CurrencyCode
            );
        } else {
            return `₿${Number(amount) || 0}`;
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
            <YStack items="center" gap="$3" width="100%">
                {/* Mint Selector & Balance Row */}
                <XStack
                    justify="space-between"
                    items="center"
                    width="100%"
                    bg="$gray2"
                    px="$3"
                    py="$3"
                    rounded="$5"
                >
                    <XStack
                        gap="$2"
                        items="center"
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
                            refreshMintList();
                            mintSheetRef.current?.present();
                        }}
                        pressStyle={{ opacity: 0.7 }}
                        flex={1}
                        mr="$2"
                    >
                        {isLoadingMint ? (
                            <Spinner size={14} color="$accent10" />
                        ) : (
                            <Avatar rounded="$3" size="$2">
                                <Avatar.Image src={activeMint?.icon} />
                                <Avatar.Fallback
                                    backgroundColor="$gray4"
                                    alignItems="center"
                                    justifyContent="center"
                                >
                                    <Sprout size={14} color="$accent10" />
                                </Avatar.Fallback>
                            </Avatar>
                        )}
                        <Text fontSize="$3" fontWeight="700" color="$color" numberOfLines={1} style={{ maxWidth: 140 }}>
                            {isLoadingMint ? "Loading..." : displayName}
                        </Text>
                        <ChevronDown size={18} color="$gray10" />
                    </XStack>
                    <XStack gap="$2" items="center">
                        <Text fontSize="$3" color="$accent6" fontWeight="500">
                            ₿{balance.toLocaleString('en-US')}
                        </Text>
                        <Button
                            size="$2"
                            rounded="$3"
                            borderWidth={0}
                            color="$color"
                            fontWeight="600"
                            onPress={handleMax}
                            disabled={balance === 0}
                            pressStyle={{ scale: 0.96, bg: "$gray4" }}
                        >
                            Max
                        </Button>
                    </XStack>
                </XStack>

                {/* Card Box Container matching AmountStage & P2PKAmountStage */}
                <YStack
                    width="100%"
                    bg="$gray2"
                    rounded="$5"
                    p="$4"
                    items="center"
                    gap="$3"
                    borderWidth={0}
                >
                    {/* Amount Display Section */}
                    <YStack items="center" justify="center" py="$3" gap="$2" width="100%">
                        {error || isOverBalance ? (
                            <Text color="$red10" fontSize="$3" fontWeight="600" text="center">
                                {error || "Exceeds available balance"}
                            </Text>
                        ) : (
                            <Text color="$gray10" fontSize="$3" fontWeight="500">
                                How much to send?
                            </Text>
                        )}

                        <H1
                            fontSize={dynamicFontSize}
                            fontVariant={['tabular-nums']}
                            fontWeight="700"
                            letterSpacing={-1}
                            py="$2"
                            color={isOverBalance ? "$red10" : "$color"}
                            text="center"
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            style={{ maxWidth: '100%', overflow: 'hidden' }}
                        >
                            {inputMode === 'SATS' ? `₿${formattedDisplayValue}` : `${currencySymbol}${formattedDisplayValue}`}
                        </H1>

                        <Button
                            size="$3"
                            rounded="$10"
                            bg="$gray5"
                            pressStyle={{ scale: 0.96, bg: "$gray5" }}
                            onPress={toggleMode}
                            iconAfter={<ArrowUpDown size={14} color="$accent10" strokeWidth={2.5} />}
                        >
                            {conversionValue}
                        </Button>
                    </YStack>
                </YStack>

                {/* Recipient display / selector bar */}
                <XStack
                    width="100%"
                    bg="$gray2"
                    rounded="$5"
                    px="$3"
                    py="$3"
                    items="center"
                    justify="space-between"
                    onPress={hasRecipient ? clearRecipient : () => contactSheetRef.current?.present()}
                    pressStyle={{ opacity: 0.8 }}
                >
                    <XStack gap="$3" items="center" flex={1}>
                        {hasRecipient ? (
                            <Blockies seed={recipientNpub} size={8} scale={3} style={{ borderRadius: 3 }} />
                        ) : (
                            <View bg="$accent4" p="$2" rounded="$10">
                                <User size={16} color="$accent10" />
                            </View>
                        )}
                        <YStack flex={1}>
                            <Text fontWeight="800" fontSize="$3" numberOfLines={1}>
                                {hasRecipient
                                    ? (recipientUsername || formatNpub(recipientNpub))
                                    : 'Select Recipient'}
                            </Text>
                            {hasRecipient && recipientUsername && (
                                <Text fontSize="$2" color="$gray10" numberOfLines={1}>{formatNpub(recipientNpub)}</Text>
                            )}
                        </YStack>
                    </XStack>
                    {hasRecipient ? (
                        <Button size="$2" circular icon={<X size={14} color="$color" />} onPress={clearRecipient} />
                    ) : (
                        <ChevronDown size={16} color="$gray10" />
                    )}
                </XStack>
            </YStack>

            <NumericKeypad
                showAmountDisplay={false}
                value={localInputValue}
                onValueChange={onKeypadChange}
                onConfirm={onContinue}
                confirmLabel={isLoading ? "Processing..." : "Continue"}
                confirmDisabled={!isValidAmount || isLoading}
                confirmIcon={isLoading ? <Spinner size="small" /> : undefined}
            />

            {/* ── Contact Search Sheet ──────────────────────────────────── */}
            <AppBottomSheet ref={contactSheetRef} snapPoints={["70%", "90%"]}>
                <YStack p="$4" gap="$3" flex={1}>
                    <Text fontSize="$6" fontWeight="800" color="$accent5" textAlign="center">Send to</Text>

                    <XStack width="100%" bg="$gray4" rounded="$4" px="$3" height={50} items="center" gap="$2">
                        <Search size={20} color="$gray10" />
                        <Input
                            flex={1}
                            borderWidth={0}
                            bg="transparent"
                            placeholder="Search username or paste npub"
                            value={search}
                            onChangeText={handleSearchChange}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <Button size="$2" chromeless icon={<ClipboardPaste size={18} />} onPress={handlePaste} />
                    </XStack>

                    <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                        <YStack gap="$2" pb="$4">
                            {results.map((contact, i) => (
                                <XStack
                                    key={i} bg="$gray3" p="$3" rounded="$4" items="center" gap="$3"
                                    onPress={() => selectContact(contact)} pressStyle={{ opacity: 0.7 }}
                                >
                                    <Blockies seed={contact.npub} size={10} scale={3} style={{ borderRadius: 3 }} />
                                    <YStack flex={1}>
                                        <Text fontSize="$4" fontWeight="700" color="$color">
                                            {contact.username ? `${contact.username}@bey.cash` : 'Unknown User'}
                                        </Text>
                                        <Text fontSize="$2" color="$gray10" numberOfLines={1}>{formatNpub(contact.npub)}</Text>
                                    </YStack>
                                </XStack>
                            ))}

                            {search.length > 0 && results.length === 0 && (
                                <Text color="$gray10" textAlign="center" mt="$4">No contacts found</Text>
                            )}

                            {/* Favorites */}
                            {favoriteContacts.length > 0 && !search && (
                                <YStack mt="$3" gap="$2">
                                    <Text fontSize="$3" fontWeight="600" color="$gray10" px="$1">Favorites</Text>
                                    {favoriteContacts.map((contact: any, i: number) => (
                                        <XStack
                                            key={`fav-${i}`} bg="$gray3" p="$3" rounded="$4" items="center" gap="$3"
                                            onPress={() => selectContact(contact)} pressStyle={{ opacity: 0.7 }}
                                        >
                                            <Blockies seed={contact.npub} size={10} scale={3} style={{ borderRadius: 3 }} />
                                            <YStack flex={1}>
                                                <Text fontSize="$4" fontWeight="700" color="$color">
                                                    {contact.username ? `${contact.username}@bey.cash` : 'Unknown'}
                                                </Text>
                                                <Text fontSize="$2" color="$gray10" numberOfLines={1}>{formatNpub(contact.npub)}</Text>
                                            </YStack>
                                        </XStack>
                                    ))}
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
