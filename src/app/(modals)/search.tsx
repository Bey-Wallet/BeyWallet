import React, { useState, useEffect, useCallback } from 'react';
import { YStack, XStack, Text, Input, Button, Spinner } from 'tamagui';
import { Search, X, ClipboardPaste, ScanQrCode } from '@tamagui/lucide-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { nip19 } from 'nostr-tools';
import Blockies from '~/components/UI/Blockies';
import { Buffer } from 'buffer';
import { useContactsStore } from '~/store/contactsStore';
import { useWalletStore } from '~/store/walletStore';
import { sqliteStorage } from '~/store/sqliteStorage';
import { FlatList } from 'react-native';
import * as Haptics from 'expo-haptics';

// Fallback if FlashList is not yet installed or has issues
// const ListComponent = FlashList;

type SearchResultType = 'people' | 'mint' | 'address' | 'recent' | 'header';

interface SearchResultItem {
    id: string;
    type: SearchResultType;
    title: string;
    subtitle?: string;
    data: any;
}

export default function UniversalSearchScreen() {
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<SearchResultItem[]>([]);
    const [recentSearches, setRecentSearches] = useState<SearchResultItem[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [directory, setDirectory] = useState<Record<string, string>>({});
    const router = useRouter();
    
    const { favorites } = useContactsStore();
    const { mints } = useWalletStore();

    // Load directory and recent searches
    useEffect(() => {
        const fetchDirectory = async () => {
            try {
                const res = await fetch(`https://bey.cash/.well-known/nostr.json?_t=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data?.names) setDirectory(data.names);
                }
            } catch (err) {
                console.error('[Search] Failed to fetch directory:', err);
            }
        };
        
        const loadRecents = () => {
            const cached = sqliteStorage.getItem('recent_searches');
            if (cached) {
                try {
                    setRecentSearches(JSON.parse(cached));
                } catch (e) {
                    console.error('[Search] Failed to parse recents:', e);
                }
            }
        };

        fetchDirectory();
        loadRecents();
    }, []);

    const saveRecents = (updated: SearchResultItem[]) => {
        setRecentSearches(updated);
        sqliteStorage.setItem('recent_searches', JSON.stringify(updated));
    };

    const handlePaste = async () => {
        const text = await Clipboard.getStringAsync();
        if (text) {
            setSearch(text);
            doSearch(text);
        }
    };

    const doSearch = useCallback((query: string) => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        const lowerQuery = query.toLowerCase().trim();
        const found: SearchResultItem[] = [];

        // 1. Search People (Directory & Favorites)
        const peopleResults: SearchResultItem[] = [];
        
        // Check favorites first
        Object.values(favorites).forEach((contact: any) => {
            if (contact.username?.toLowerCase().includes(lowerQuery) || contact.npub?.toLowerCase().includes(lowerQuery)) {
                peopleResults.push({
                    id: `fav-${contact.npub}`,
                    type: 'people',
                    title: contact.username ? `${contact.username}@bey.cash` : 'Unknown User',
                    subtitle: contact.npub,
                    data: contact,
                });
            }
        });

        // Check directory
        for (const [name, pubkey] of Object.entries(directory)) {
            if (name.toLowerCase().includes(lowerQuery)) {
                try {
                    const npub = nip19.npubEncode(pubkey);
                    if (!peopleResults.some(p => p.subtitle === npub)) {
                        peopleResults.push({
                            id: `dir-${npub}`,
                            type: 'people',
                            title: `${name}@bey.cash`,
                            subtitle: npub,
                            data: { username: name, npub, hex: pubkey },
                        });
                    }
                } catch {
                    // ignore invalid pubkeys
                }
            }
        }

        if (peopleResults.length > 0) {
            found.push({ id: 'header-people', type: 'header', title: 'People', data: {} });
            found.push(...peopleResults);
        }

        // 2. Search Mints
        const mintResults: SearchResultItem[] = [];
        mints.forEach(mint => {
            if (mint.mintUrl.toLowerCase().includes(lowerQuery) || (mint.nickname && mint.nickname.toLowerCase().includes(lowerQuery))) {
                mintResults.push({
                    id: `mint-${mint.mintUrl}`,
                    type: 'mint',
                    title: mint.nickname || mint.name || 'Mint',
                    subtitle: mint.mintUrl,
                    data: mint,
                });
            }
        });

        if (mintResults.length > 0) {
            found.push({ id: 'header-mints', type: 'header', title: 'Mints', data: {} });
            found.push(...mintResults);
        }

        // 3. Search Addresses (npub, etc)
        const addressResults: SearchResultItem[] = [];
        if (lowerQuery.startsWith('npub1')) {
            try {
                const decoded = nip19.decode(lowerQuery);
                if (decoded.type === 'npub') {
                    const hex = decoded.data as string;
                    // Look up in directory
                    const foundName = Object.keys(directory).find(name => directory[name] === hex);
                    
                    addressResults.push({
                        id: `addr-${lowerQuery}`,
                        type: 'address',
                        title: foundName ? `${foundName}@bey.cash` : lowerQuery,
                        subtitle: foundName ? lowerQuery : undefined,
                        data: { npub: lowerQuery, username: foundName },
                    });
                }
            } catch {
                // invalid npub
            }
        }

        if (addressResults.length > 0) {
            found.push({ id: 'header-addresses', type: 'header', title: 'Addresses', data: {} });
            found.push(...addressResults);
        }

        setResults(found);
    }, [directory, favorites, mints]);

    // Debounce search
    useEffect(() => {
        if (!search.trim()) {
            setResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        const timer = setTimeout(() => {
            doSearch(search);
            setIsSearching(false);
        }, 300);
        return () => clearTimeout(timer);
    }, [search, doSearch]);

    const onSelectItem = (item: SearchResultItem) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        
        // Add to recents
        if (item.type !== 'header') {
            const updatedRecents = [item, ...recentSearches.filter(r => r.id !== item.id)].slice(0, 5);
            saveRecents(updatedRecents);
        }

        if (item.type === 'people' || item.type === 'address') {
            router.push({
                pathname: '/(modals)/contact-details',
                params: {
                    npub: item.subtitle || item.title,
                    username: item.title.includes('@bey.cash') ? item.title.replace('@bey.cash', '') : ''
                }
            });
        } else if (item.type === 'mint') {
            router.push({ pathname: '/(modals)/mint-profile', params: { url: item.subtitle || '' } });
        }
    };

    const renderItem = ({ item }: { item: SearchResultItem }) => {
        if (item.type === 'header') {
            return (
                <YStack px="$4" py="$2" bg="$background">
                    <Text fontSize="$4" fontWeight="600" color="$gray10">
                        {item.title}
                    </Text>
                </YStack>
            );
        }

        return (
            <XStack
                p="$3"
                mx="$4"
                my="$1"
                bg="$gray3"
                rounded="$4"
                items="center"
                gap="$3"
                onPress={() => onSelectItem(item)}
            >
                {item.type === 'people' || item.type === 'address' ? (
                    <Blockies seed={item.subtitle || 'default'} size={10} scale={3} style={{ borderRadius: 4 }} />
                ) : (
                    <YStack width={30} height={30} bg="$gray5" rounded="$2" items="center" justify="center">
                        <Search size={16} color="$gray11" />
                    </YStack>
                )}
                <YStack flex={1}>
                    <Text fontSize="$5" fontWeight="600" color="$color">
                        {item.title}
                    </Text>
                    {item.subtitle && (
                        <Text fontSize="$3" color="$gray10" numberOfLines={1}>
                            {item.subtitle.length > 30 ? `${item.subtitle.slice(0, 15)}...${item.subtitle.slice(-15)}` : item.subtitle}
                        </Text>
                    )}
                </YStack>
            </XStack>
        );
    };

    const displayList = search.trim() ? results : [
        ...(recentSearches.length > 0 ? [{ id: 'header-recent', type: 'header', title: 'Recent', data: {} } as SearchResultItem, ...recentSearches] : [])
    ];

    return (
        <YStack flex={1} bg="$background" gap="$2">
            <XStack px="$4" py="$2" gap="$2" items="center">
                <XStack flex={1} bg="$gray4" rounded="$4" px="$3" height={50} items="center" gap="$2">
                    <Search size={20} color="$gray10" />
                    <Input
                        flex={1}
                        borderWidth={0}
                        bg="transparent"
                        placeholder="Search people, mints, addresses..."
                        value={search}
                        onChangeText={setSearch}
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoFocus={true}
                    />
                    {isSearching ? (
                        <Spinner size="small" />
                    ) : search.length > 0 ? (
                        <Button size="$2" chromeless icon={<X size={16} />} onPress={() => setSearch('')} />
                    ) : (
                        <Button size="$2" chromeless icon={<ClipboardPaste size={18} color="$gray10" />} onPress={handlePaste} />
                    )}
                </XStack>
            </XStack>

            <YStack flex={1} width="100%">
                {search.trim() !== '' && results.length === 0 && !isSearching ? (
                    <YStack flex={1} items="center" justify="center" gap="$3" px="$4">
                        <Search size={48} color="$gray8" />
                        <Text fontSize="$5" fontWeight="600" color="$gray10">No results found</Text>
                        <Text color="$gray8" textAlign="center">
                            We couldn't find any people, mints, or addresses matching "{search}".
                        </Text>
                    </YStack>
                ) : search.trim() === '' && recentSearches.length === 0 ? (
                    <YStack flex={1} items="center" justify="center" gap="$3" px="$4">
                        <Search size={48} color="$gray6" />
                        <Text fontSize="$5" fontWeight="600" color="$gray8">Search anything</Text>
                        <Text color="$gray8" textAlign="center">
                            Search for people on @bey.cash, mints on Nostr, or paste an address.
                        </Text>
                    </YStack>
                ) : (
                    <FlatList
                        data={displayList}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id}
                        extraData={search}
                        contentContainerStyle={{ paddingBottom: 20 }}
                    />
                )}
            </YStack>
        </YStack>
    );
}
