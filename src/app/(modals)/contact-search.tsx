import React, { useState, useEffect } from 'react';
import { YStack, XStack, Text, Input, Button, ScrollView } from 'tamagui';
import { Search, ClipboardPaste, QrCode, ScanQrCode } from '@tamagui/lucide-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { nip19 } from 'nostr-tools';
import Blockies from '~/components/UI/Blockies';
import { Buffer } from 'buffer';
import { useContactsStore } from '~/store/contactsStore';

export default function ContactSearchScreen() {
    const favorites = useContactsStore(state => state.favorites);
    const favoriteContacts = Object.values(favorites);
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [directory, setDirectory] = useState<Record<string, string>>({});
    const router = useRouter();

    useEffect(() => {
        // Fetch bey.cash directory
        const fetchDirectory = async () => {
            try {
                const res = await fetch(`https://bey.cash/.well-known/nostr.json?_t=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data?.names) setDirectory(data.names);
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchDirectory();
    }, []);

    const handlePaste = async () => {
        const text = await Clipboard.getStringAsync();
        if (text) {
            setSearch(text);
            doSearch(text, directory);
        }
    };

    const doSearch = (query: string, dict: Record<string, string> = directory) => {
        if (!query) {
            setResults([]);
            return;
        }

        const lowerQuery = query.toLowerCase().trim();
        const found: any[] = [];

        // Check if query is npub
        if (lowerQuery.startsWith('npub1')) {
            try {
                const decoded = nip19.decode(lowerQuery);
                if (decoded.type === 'npub') {
                    let hex = '';
                    const data = decoded.data as unknown;
                    if (typeof data === 'string') hex = data.toLowerCase();
                    else if (data instanceof Uint8Array) hex = Buffer.from(data).toString('hex');

                    // See if we have a username for this hex
                    let username = null;
                    for (const [name, pubkey] of Object.entries(dict)) {
                        if (pubkey.toLowerCase() === hex) {
                            username = name;
                            break;
                        }
                    }
                    found.push({ npub: lowerQuery, username, hex });
                }
            } catch {
                // invalid npub, ignore
            }
        } else {
            // Search by username
            for (const [name, pubkey] of Object.entries(dict)) {
                if (name.toLowerCase().includes(lowerQuery)) {
                    // convert hex to npub
                    try {
                        const npub = nip19.npubEncode(pubkey);
                        found.push({ npub, username: name, hex: pubkey });
                    } catch {
                        // ignore invalid pubkeys
                    }
                }
            }
        }

        setResults(found);
    };

    const handleSearchChange = (text: string) => {
        setSearch(text);
        doSearch(text);
    };

    const onSelectContact = (contact: any) => {
        router.push({
            pathname: '/(modals)/contact-details',
            params: {
                npub: contact.npub,
                username: contact.username || ''
            }
        });
    };

    const formatNpub = (str: string | null) => {
        if (!str) return '';
        if (str.length < 20) return str;
        return `${str.slice(0, 8)}...${str.slice(-6)}`;
    };

    return (
        <YStack bg="$background" p="$4" gap="$4">
            <XStack items="center" gap="$2" width="100%">
                <XStack width="100%" justify="space-between" items="center" bg="$gray4" rounded="$4" px="$3" height={50}>
                    <XStack items="center" gap="$2">

                        <Search size={20} color="$gray10" />
                        <Input

                            borderWidth={0}
                            bg="transparent"
                            placeholder="Search by username or npub"
                            value={search}
                            onChangeText={handleSearchChange}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </XStack>
                    <XStack>

                        <Button size="$2" chromeless icon={<ClipboardPaste size={20} />} onPress={handlePaste} />
                        <Button size="$2" chromeless icon={<ScanQrCode size={20} />} onPress={handlePaste} />
                    </XStack>
                </XStack>
            </XStack>

            <ScrollView showsVerticalScrollIndicator={false}>
                <YStack gap="$2">
                    {results.map((contact, i) => (
                        <XStack
                            key={i}
                            bg="$gray3"
                            p="$3"
                            rounded="$4"
                            items="center"
                            gap="$3"
                            cursor="pointer"
                            onPress={() => onSelectContact(contact)}
                        >
                            <Blockies seed={contact.npub} size={12} scale={3} style={{ borderRadius: 3 }} />
                            <YStack >
                                <Text fontSize="$5" fontWeight="600" color="$color">
                                    {contact.username ? `${contact.username}@bey.cash` : 'Unknown User'}
                                </Text>
                                <Text fontSize="$3" color="$gray10" numberOfLines={1}>
                                    {formatNpub(contact.npub)}
                                </Text>
                            </YStack>
                        </XStack>
                    ))}
                    {search.length > 0 && results.length === 0 && (
                        <Text color="$gray10" textAlign="center" mt="$4">
                            No contacts found
                        </Text>
                    )}

                    {favoriteContacts.length > 0 && (
                        <YStack mt="$4" gap="$2">
                            <Text fontSize="$4" fontWeight="600" color="$gray10" px="$2">
                                Favorites
                            </Text>
                            {favoriteContacts.map((contact, i) => (
                                <XStack
                                    key={`fav-${i}`}
                                    bg="$gray3"
                                    p="$3"
                                    rounded="$4"
                                    items="center"
                                    gap="$3"
                                    cursor="pointer"
                                    onPress={() => onSelectContact(contact)}
                                >
                                    <Blockies seed={contact.npub} size={12} scale={3} style={{ borderRadius: 3 }} />
                                    <YStack>
                                        <Text fontSize="$5" fontWeight="600" color="$color">
                                            {contact.username ? `${contact.username}@bey.cash` : 'Unknown User'}
                                        </Text>
                                        <Text fontSize="$3" color="$gray10" numberOfLines={1}>
                                            {formatNpub(contact.npub)}
                                        </Text>
                                    </YStack>
                                </XStack>
                            ))}
                        </YStack>
                    )}
                </YStack>
            </ScrollView>
        </YStack>
    );
}
