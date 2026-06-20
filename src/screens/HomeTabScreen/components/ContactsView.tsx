import React, { useState, useEffect, useMemo } from 'react'
import { Button, H6, Text, XStack, YStack, Spinner, Separator, YGroup, ListItem } from 'tamagui'
import { Search, ChevronRight, Star, UserPlus2 } from '@tamagui/lucide-icons'
import Blockies from '~/components/UI/Blockies'
import { useRouter } from 'expo-router'
import { useContactsStore } from '~/store/contactsStore'
import * as Haptics from 'expo-haptics'

const ContactsView = () => {
    const [filter, setFilter] = useState<'all' | 'favorites'>('all')
    const [isMounted, setIsMounted] = useState(false)
    const router = useRouter()

    const favorites = useContactsStore(state => state.favorites)
    const contacts = useContactsStore(state => state.contacts || {})

    useEffect(() => {
        // Defer rendering of heavy Blockies to avoid blocking the initial index.tsx mount
        const timer = setTimeout(() => setIsMounted(true), 50);
        return () => clearTimeout(timer);
    }, []);

    // Combine favorites and normal contacts based on filter
    const combinedContacts = useMemo(() => {
        const list: any[] = [];
        const seen = new Set<string>();

        // Always add favorites
        Object.values(favorites).forEach(fav => {
            list.push({
                id: fav.npub,
                name: fav.username || 'Unknown',
                seed: fav.npub,
                isFav: true,
            });
            seen.add(fav.npub);
        });

        // Add normal contacts only if filter is 'all'
        if (filter === 'all') {
            Object.values(contacts).forEach(contact => {
                if (!seen.has(contact.npub)) {
                    list.push({
                        id: contact.npub,
                        name: contact.username || 'Unknown',
                        seed: contact.npub,
                        isFav: false,
                    });
                }
            });
        }

        return list;
    }, [favorites, contacts, filter]);

    const visibleContacts = combinedContacts;

    if (!isMounted) {
        return (
            <YStack width="100%" gap="$4" px="$1" py="$4" items="center" justify="center" minH={100}>
                <Spinner size="small" color="$gray10" />
            </YStack>
        );
    }

    // Show empty state only when they have absolutely no contacts at all
    const hasAnyContacts = Object.keys(favorites).length > 0 || Object.keys(contacts).length > 0;

    if (!hasAnyContacts) {
        return (
            <YStack width="100%" gap="$4" px="$1">
                <XStack>
                    <H6 color="$gray10" borderBottomWidth={1} borderBottomColor="$gray10" borderStyle='dashed'>Contacts</H6>
                </XStack>
                <YStack items="center" justify="center" p="$6" bg="$gray3" rounded={16} width="100%" gap="$4">
                    <UserPlus2 size={32} color="$gray8" />
                    <Text text="center" color="$gray10" fontSize="$5">
                        Get started by adding friends and pay them
                    </Text>
                    <Button
                        size="$4"
                        themeInverse
                        onPress={() => router.push('/(modals)/search')}
                        icon={<Search size={18} />}
                    >
                        Search Contacts
                    </Button>
                </YStack>
            </YStack>
        );
    }

    return (
        <YStack width="100%" gap="$3" px="$1">
            <XStack justify="space-between" items="center">
                <H6 color="$gray10" borderBottomWidth={1} borderBottomColor="$gray10" borderStyle='dashed'>Contacts</H6>
                <XStack justify="space-between" items="center" py="$1" gap="$2">
                    {/* Two-button filter: All / Favorites */}
                    <XStack items="center">
                        <Button
                            size="$2.5"
                            bg={filter === 'all' ? '$gray6' : 'transparent'}
                            chromeless={filter !== 'all'}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setFilter('all');
                            }}
                            px="$3"
                            rounded={6}
                        >
                            All
                        </Button>
                        <Button
                            size="$2.5"
                            bg={filter === 'favorites' ? '$gray6' : 'transparent'}
                            chromeless={filter !== 'favorites'}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setFilter('favorites');
                            }}
                            px="$3"
                            rounded={6}
                        >
                            Favorites
                        </Button>
                    </XStack>
                </XStack>
            </XStack>

            <YGroup rounded="$5" bg="$gray2" overflow="hidden" separator={<Separator borderColor="$borderColor" opacity={0.5} />}>
                {/* Contacts List */}
                {visibleContacts.length === 0 ? (
                    <YGroup.Item>
                        <ListItem
                            title={<Text fontSize="$3" color="$gray10" text="center">No favorites added yet</Text>}
                            py="$4"
                            px="$4"
                            disabled
                        />
                    </YGroup.Item>
                ) : (
                    visibleContacts.map((contact) => {
                        const isFav = !!favorites[contact.seed];
                        const shortenedNpub = `${contact.seed.slice(0, 10)}...${contact.seed.slice(-8)}`;

                        return (
                            <YGroup.Item key={contact.id}>
                                <ListItem
                                    hoverStyle={{ bg: '$backgroundHover' }}
                                    pressStyle={{ bg: '$backgroundPress' }}
                                    bg="transparent"

                                    icon={<Blockies seed={contact.seed} size={10} scale={4} style={{ borderRadius: 5 }} />}
                                    title={
                                        <XStack items="center" gap="$2">
                                            <H6 fontSize="$5" fontWeight="600" color={isFav ? "$blue10" : "$color"}>
                                                {contact.name}
                                            </H6>
                                            {isFav && (
                                                <Star size={12} color="$blue10" fill="$blue10" />
                                            )}
                                        </XStack>
                                    }
                                    subTitle={<Text fontSize="$2" color="$gray10" fontWeight="600">{shortenedNpub}</Text>}
                                    iconAfter={<ChevronRight size={18} strokeWidth={3} color="$gray9" />}
                                    py="$2"
                                    px="$2.5"
                                    pr="$3"
                                    onPress={() => router.push({
                                        pathname: '/(modals)/contact-details',
                                        params: { npub: contact.seed, username: contact.name }
                                    })}
                                />
                            </YGroup.Item>
                        );
                    })
                )}
            </YGroup>
        </YStack>
    )
}

export default ContactsView