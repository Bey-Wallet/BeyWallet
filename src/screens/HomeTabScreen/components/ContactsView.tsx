import React, { useState } from 'react'
import { Button, H6, Text, Theme, XStack, YStack } from 'tamagui'
import { Plus, Send, ChevronDown, ChevronUp, Loader } from '@tamagui/lucide-icons'
import Blockies from '~/components/UI/Blockies'

const MOCK_CONTACTS = [
    { id: '1', name: 'Zaheer', seed: '0x1234567890123456789012345678901234567890' },
    { id: '2', name: 'Bohs', seed: '0x12367890123456789012345678901234567890' },
    { id: '3', name: 'nhhh', seed: '45678901234789012345678901234567890' },
    { id: '4', name: 'Alice', seed: '0xabc123456789012345678901234567890' },
    { id: '5', name: 'Bob', seed: '0xdef123456789012345678901234567890' },
    { id: '6', name: 'Charlie', seed: '0xghi123456789012345678901234567890' },
    { id: '7', name: 'Dave', seed: '0xjkl123456789012345678901234567890' },
    { id: '8', name: 'Eve', seed: '0xmno123456789012345678901234567890' },
    { id: '9', name: 'Frank', seed: '0xpqr123456789012345678901234567890' },
    { id: '10', name: 'Grace', seed: '0xstu123456789012345678901234567890' },
    { id: '11', name: 'Heidi', seed: '0xvwx123456789012345678901234567890' },
    { id: '12', name: 'Ivan', seed: '0xyz1234567890123456789012345678900' },
    { id: '13', name: 'Judy', seed: '0x123abc456789012345678901234567890' },
    { id: '14', name: 'Mallory', seed: '0x456def789012345678901234567890123' },
    { id: '15', name: 'Peggy', seed: '0x789ghi012345678901234567890123456' },

    { "id": "16", "name": "zapmaster", "seed": "0xabc123def4567890fedcba0987654321" },
    { "id": "17", "name": "nostrninja", "seed": "0xfeedface1234567890abcdefabcdef12" },
    { "id": "18", "name": "lightninglu", "seed": "0xdeadbeefcafebabedeadbeefcafebab3" },
    { "id": "19", "name": "satslayer", "seed": "0x1234567890abcdef1234567890abcdef" },
    { "id": "20", "name": "zapperone", "seed": "0xfedcba0987654321fedcba098765432f" },
    { "id": "21", "name": "pubkeypirate", "seed": "0x69696969696969696969696969696969" },
    { "id": "22", "name": "eventeater", "seed": "0xbadbadbadbadbadbadbadbadbadbadba" },
    { "id": "23", "name": "relayrider", "seed": "0x0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f" },
    { "id": "24", "name": "kindcaster", "seed": "0x11111111111111111111111111111111" },
    { "id": "25", "name": "npubninja", "seed": "0x22222222222222222222222222222222" },
    { "id": "26", "name": "sigsmith", "seed": "0x33333333333333333333333333333333" },
    { "id": "27", "name": "hashhound", "seed": "0x44444444444444444444444444444444" },
    { "id": "28", "name": "note ninja", "seed": "0x55555555555555555555555555555555" },
    { "id": "29", "name": "dmghost", "seed": "0x66666666666666666666666666666666" },
    { "id": "30", "name": "zapzapzap", "seed": "0x77777777777777777777777777777777" }

]

const ContactsView = () => {
    const [isExpanded, setIsExpanded] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    
    const visibleContacts = isExpanded ? MOCK_CONTACTS : MOCK_CONTACTS.slice(0, 7)

    const handleToggle = () => {
        if (isExpanded) {
            setIsExpanded(false)
        } else {
            setIsLoading(true)
            // Yield the main thread to allow the loading spinner to paint
            setTimeout(() => {
                setIsExpanded(true)
                setIsLoading(false)
            }, 50)
        }
    }

    return (
        <YStack width="100%" gap="$4" px="$1" >
            <XStack>
                <H6 color="$gray10" borderBottomWidth={1} borderBottomColor="$gray10" borderStyle='dashed'>Contacts</H6>
            </XStack>
            <XStack gap="$3" width="100%" flexWrap="wrap">
                {/* Add Button */}
                <Theme inverse>
                    <XStack bg="$gray4" items="center" p="$2" pr="$3" rounded="$4" gap={10}>
                        <YStack width={24} height={24} bg="$gray6" rounded={3} items="center" justify="center">
                            <Send size={16} color="$color" />
                        </YStack>
                        <Text fontSize="$5">Send New</Text>
                    </XStack>
                </Theme>

                {visibleContacts.map((contact) => (
                    <XStack key={contact.id} bg="$gray4" items="center" p="$2" pr="$3" rounded="$4" gap={10}>
                        <Blockies seed={contact.seed} size={12} scale={2} style={{ borderRadius: 3 }} />
                        <Text fontSize="$5">{contact.name}</Text>
                    </XStack>
                ))}

                {MOCK_CONTACTS.length > 7 && (
                    <XStack
                        items="center"
                        gap={10}
                        cursor="pointer"
                        onPress={handleToggle}
                        opacity={isLoading ? 0.7 : 1}
                    >
                        <YStack width={30} height={30} bg="$gray6" rounded="$4" items="center" justify="center">
                            {isLoading ? (
                                <Loader size={16} color="$color" strokeWidth={3} />
                            ) : isExpanded ? (
                                <ChevronUp size={16} color="$color" strokeWidth={3} />
                            ) : (
                                <ChevronDown size={16} color="$color" strokeWidth={3} />
                            )}
                        </YStack>
                        <Text fontSize="$5">
                            {isLoading ? 'Loading...' : isExpanded ? 'Collapse' : 'Expand All'}
                        </Text>
                    </XStack>
                )}
            </XStack>
        </YStack>
    )
}

export default ContactsView