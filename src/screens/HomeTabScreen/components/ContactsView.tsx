import React, { useState, useEffect, useMemo } from 'react'
import { Button, H6, Text, Theme, XStack, YStack, Spinner } from 'tamagui'
import { Search, ChevronDown, ChevronUp, Loader, User, UserPlus2 } from '@tamagui/lucide-icons'
import Blockies from '~/components/UI/Blockies'
import { useRouter } from 'expo-router'
import { useContactsStore } from '~/store/contactsStore'

const ContactsView = () => {
    const [isExpanded, setIsExpanded] = useState(false)
    const [isLoadingToggle, setIsLoadingToggle] = useState(false)
    const [isMounted, setIsMounted] = useState(false)
    const router = useRouter()

    const favorites = useContactsStore(state => state.favorites)
    const contacts = useContactsStore(state => state.contacts || {})

    useEffect(() => {
        // Defer rendering of heavy Blockies to avoid blocking the initial index.tsx mount
        const timer = setTimeout(() => setIsMounted(true), 50);
        return () => clearTimeout(timer);
    }, []);

    // Combine favorites and normal contacts
    const combinedContacts = useMemo(() => {
        const list: any[] = [];
        const seen = new Set<string>();

        Object.values(favorites).forEach(fav => {
            list.push({
                id: fav.npub,
                name: fav.username || 'Unknown',
                seed: fav.npub,
            });
            seen.add(fav.npub);
        });

        Object.values(contacts).forEach(contact => {
            if (!seen.has(contact.npub)) {
                list.push({
                    id: contact.npub,
                    name: contact.username || 'Unknown',
                    seed: contact.npub,
                });
            }
        });

        return list;
    }, [favorites, contacts]);

    const visibleContacts = isExpanded ? combinedContacts : combinedContacts.slice(0, 7)

    const handleToggle = () => {
        if (isExpanded) {
            setIsExpanded(false)
        } else {
            setIsLoadingToggle(true)
            setTimeout(() => {
                setIsExpanded(true)
                setIsLoadingToggle(false)
            }, 50)
        }
    }

    if (!isMounted) {
        return (
            <YStack width="100%" gap="$4" px="$1" py="$4" items="center" justify="center" minHeight={100}>
                <Spinner size="small" color="$gray10" />
            </YStack>
        );
    }

    if (combinedContacts.length === 0) {
        return (
            <YStack width="100%" gap="$4" px="$1">
                <XStack>
                    <H6 color="$gray10" borderBottomWidth={1} borderBottomColor="$gray10" borderStyle='dashed'>Contacts</H6>
                </XStack>
                <YStack items="center" justify="center" p="$6" bg="$gray2" rounded="$5" width="100%" gap="$4">
                    <UserPlus2 size={32} color="$gray8" />
                    <Text textAlign="center" color="$gray10" fontSize="$5">
                        Get started by adding friends and pay them
                    </Text>
                    <Button
                        size="$4"
                        theme="inverse"
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
        <YStack width="100%" gap="$4" px="$1" >
            <XStack>
                <H6 color="$gray10" borderBottomWidth={1} borderBottomColor="$gray10" borderStyle='dashed'>Contacts</H6>
            </XStack>
            <XStack gap="$3" width="100%" flexWrap="wrap">
                {/* Search / Add Button */}
                <Theme inverse>
                    <XStack cursor="pointer" onPress={() => router.push('/(modals)/search')} bg="$gray4" items="center" p="$2" pr="$3" rounded="$4" gap={10}>
                        <YStack width={24} height={24} bg="$gray6" rounded={3} items="center" justify="center">
                            <Search size={16} color="$color" />
                        </YStack>
                        <Text fontSize="$5">Search NIP</Text>
                    </XStack>
                </Theme>

                {visibleContacts.map((contact) => {
                    const isFav = !!favorites[contact.seed];
                    return (
                        <XStack
                            key={contact.id}
                            bg={isFav ? "$pink4" : "$gray2"}
                            borderColor={isFav ? "$pink6" : "transparent"}
                            borderWidth={0}
                            items="center"
                            p="$2"
                            pr="$3"
                            rounded="$4"
                            gap={10}
                            cursor="pointer"
                            onPress={() => router.push({
                                pathname: '/(modals)/contact-details',
                                params: { npub: contact.seed, username: contact.name }
                            })}
                        >
                            <Blockies seed={contact.seed} size={12} scale={2} style={{ borderRadius: 3 }} />
                            <Text fontSize="$5" color={isFav ? "$pink11" : "$color"}>{contact.name}</Text>
                        </XStack>
                    )
                })}

                {combinedContacts.length > 7 && (
                    <XStack
                        items="center"
                        gap={10}
                        cursor="pointer"
                        onPress={handleToggle}
                        opacity={isLoadingToggle ? 0.7 : 1}
                    >
                        <YStack width={30} height={30} bg="$gray6" rounded="$4" items="center" justify="center">
                            {isLoadingToggle ? (
                                <Loader size={16} color="$color" strokeWidth={3} />
                            ) : isExpanded ? (
                                <ChevronUp size={16} color="$color" strokeWidth={3} />
                            ) : (
                                <ChevronDown size={16} color="$color" strokeWidth={3} />
                            )}
                        </YStack>
                        <Text fontSize="$5">
                            {isLoadingToggle ? 'Loading...' : isExpanded ? 'Collapse' : 'Expand All'}
                        </Text>
                    </XStack>
                )}
            </XStack>
        </YStack>
    )
}

export default ContactsView