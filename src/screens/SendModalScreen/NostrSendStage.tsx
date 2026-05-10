/**
 * NostrSendStage
 *
 * When the user selects 'Nostr' send mode, this stage opens a bottom sheet
 * for searching bey.cash usernames or pasting/scanning npubs (like contact-search).
 * After selecting a recipient, shows the amount input with the recipient displayed.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { YStack, XStack, Text, H1, Button, Input, View, ScrollView } from 'tamagui';
import {
    Search, ClipboardPaste, ScanQrCode, ChevronDown, Sprout, AlertCircle, User, X
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
    const { activeMintUrl, mints, setActiveMint } = useWalletStore();
    const { secondaryCurrency } = useSettingsStore();
    const favorites = useContactsStore(s => s.favorites);
    const favoriteContacts = Object.values(favorites);
    const [inputMode, setInputMode] = useState<'SATS' | 'FIAT'>('SATS');
    const mintSheetRef = useRef<AppBottomSheetRef>(null);
    const contactSheetRef = useRef<AppBottomSheetRef>(null);

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
    }, []);

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
        return mints.find(m => m.mintUrl.replace(/\/$/, '') === activeMintUrl.replace(/\/$/, ''));
    }, [mints, activeMintUrl]);

    const mintName = activeMint?.nickname || activeMint?.name ||
        activeMintUrl?.replace(/^https?:\/\//, '').replace(/\/$/, '') || "Select Mint";

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

    const onKeypadChange = (val: string) => {
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

    return (
        <YStack flex={1} justify="space-between">
            <YStack width="100%" rounded="$4" borderWidth={0.5} borderColor="$borderColor" bg="$color2" mb="$4">
                {/* Recipient display / change */}
                <XStack
                    width="100%"
                    p="$3"
                    items="center"
                    borderBottomWidth={1}
                    borderBottomColor="$color3"
                    justify="space-between"
                    onPress={hasRecipient ? clearRecipient : () => contactSheetRef.current?.present()}
                    pressStyle={{ bg: "$color5" }}
                >
                    <XStack gap="$3" items="center" flex={1}>
                        {hasRecipient ? (
                            <Blockies seed={recipientNpub} size={8} scale={3} style={{ borderRadius: 3 }} />
                        ) : (
                            <View bg="$purple4" p="$2" rounded="$10">
                                <User size={18} color="$purple10" />
                            </View>
                        )}
                        <YStack flex={1}>
                            <Text fontWeight="800" fontSize="$4" numberOfLines={1}>
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
                        <Button size="$2" circular bg="$gray4" icon={<X size={14} />} onPress={clearRecipient} />
                    ) : (
                        <ChevronDown size={18} color="$gray10" />
                    )}
                </XStack>

                {/* Mint Selector */}
                <XStack
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft); mintSheetRef.current?.present(); }}
                    width="100%" p="$3" items="center" borderBottomWidth={1} borderBottomColor="$color3"
                    justify="space-between" pressStyle={{ bg: "$color5" }}
                >
                    <XStack gap="$2" items="center">
                        <Sprout size={18} strokeWidth={2.5} color="$color" />
                        <Text color="$gray10" fontWeight="600">From Mint</Text>
                    </XStack>
                    <XStack gap="$2" items="center">
                        <Text fontWeight="800" fontSize="$4" numberOfLines={1} style={{ maxWidth: 120 }}>{mintName}</Text>
                        <ChevronDown size={18} strokeWidth={2.5} color="$color" />
                    </XStack>
                </XStack>

                {/* Amount Display */}
                <YStack items="center" gap="$1" py="$4">
                    <Text color="$gray10" fontSize="$3">How much to send?</Text>
                    <H1 fontWeight="400" letterSpacing={-2} py="$2" color={isOverBalance ? "$red10" : "$color"}>
                        {inputMode === 'SATS' ? `₿${localInputValue || '0'}` : `${currencySymbol}${localInputValue || '0'}`}
                    </H1>
                    <Button size="$2.5" theme="gray" fontWeight="400" color="$accent9" onPress={toggleMode} pressStyle={{ scale: 0.95 }}>
                        {conversionValue}
                    </Button>
                    {isOverBalance && (
                        <Text color="$red10" fontSize="$2" mt="$2">Exceeds available balance</Text>
                    )}
                </YStack>

                {/* Available Balance */}
                <XStack width="100%" p="$3" borderTopWidth={1} borderTopColor="$color3" justify="space-between" items="center">
                    <Text color="$gray10" fontWeight="400" fontSize="$3">Available Balance</Text>
                    <XStack gap="$2" items="center">
                        <Text color="$gray10" fontWeight="600" fontSize="$3">₿{balance}</Text>
                        <Button size="$2" onPress={handleMax} disabled={balance === 0}>Max</Button>
                    </XStack>
                </XStack>
            </YStack>

            {/* Error */}
            {error && (
                <XStack bg="$red3" p="$3" rounded="$3" gap="$2" items="center" mb="$4">
                    <AlertCircle size={18} color="$red10" />
                    <Text color="$red10" fontSize="$3" flex={1}>{error}</Text>
                </XStack>
            )}

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
            <AppBottomSheet ref={mintSheetRef} snapPoints={["50%", "85%"]}>
                <YStack p="$4" gap="$3" flex={1}>
                    <Text fontSize="$6" color="$accent5" fontWeight="bold">Select Mint</Text>
                    <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                        <YStack gap="$2" pb="$4">
                            {mints.map((mint) => (
                                <XStack
                                    key={mint.mintUrl} bg={mint.mintUrl === activeMintUrl ? "$color2" : "transparent"}
                                    p="$3" rounded="$4" items="center" gap="$3"
                                    borderWidth={mint.mintUrl === activeMintUrl ? 1 : 0} borderColor="$borderColor"
                                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setActiveMint(mint.mintUrl); mintSheetRef.current?.dismiss(); }}
                                >
                                    <Sprout size={18} color={mint.trusted ? "$green10" : "$gray10"} />
                                    <YStack flex={1}>
                                        <Text fontWeight="700">{mint.nickname || mint.name || mint.mintUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}</Text>
                                        <Text fontSize="$2" color="$gray10">{mint.mintUrl.replace('https://', '')}</Text>
                                    </YStack>
                                </XStack>
                            ))}
                        </YStack>
                    </BottomSheetScrollView>
                </YStack>
            </AppBottomSheet>
        </YStack>
    );
}
