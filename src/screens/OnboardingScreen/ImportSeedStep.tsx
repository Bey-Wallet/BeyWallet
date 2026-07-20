import React, { useState, useRef } from 'react'
import { YStack, XStack, Text, Button, H2, Input, ScrollView, View } from 'tamagui'
import { KeyRound, ClipboardPaste, CheckCircle2, AlertCircle, Trash2, Check } from '@tamagui/lucide-icons'
import * as Haptics from 'expo-haptics'
import * as Clipboard from 'expo-clipboard'
import * as bip39 from 'bip39'
import { KeyboardAvoidingView, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface ImportSeedStepProps {
    onImport: (mnemonic: string) => void
    onBack: () => void
}

export function ImportSeedStep({ onImport, onBack }: ImportSeedStepProps) {
    const [words, setWords] = useState<string[]>([])
    const [currentInput, setCurrentInput] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isValid, setIsValid] = useState(false)
    const [checkedConsent, setCheckedConsent] = useState(false)
    const insets = useSafeAreaInsets()
    const inputRef = useRef<any>(null)

    const validateMnemonic = (wordArray: string[]) => {
        if (wordArray.length < 12) {
            setIsValid(false)
            setError(null)
            return
        }

        const mnemonic = wordArray.map(w => w.trim().toLowerCase()).join(' ')
        if (bip39.validateMnemonic(mnemonic)) {
            setIsValid(true)
            setError(null)
        } else {
            setIsValid(false)
            setError('Invalid recovery phrase. Check your words and try again.')
        }
    }

    const handleInputChange = (text: string) => {
        // Handle paste or space-split words
        if (text.includes(' ')) {
            const parts = text.split(/\s+/).filter(w => w.length > 0)
            if (parts.length > 1) {
                const newWords = [...words, ...parts].slice(0, 12).map(w => w.toLowerCase().replace(/[^a-z]/g, ''))
                setWords(newWords)
                setCurrentInput('')
                validateMnemonic(newWords)
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                return
            } else if (parts.length === 1 && text.endsWith(' ')) {
                const cleanWord = parts[0].toLowerCase().replace(/[^a-z]/g, '')
                if (cleanWord.length > 0 && words.length < 12) {
                    const newWords = [...words, cleanWord]
                    setWords(newWords)
                    setCurrentInput('')
                    validateMnemonic(newWords)
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                }
                return
            }
        }
        setCurrentInput(text.toLowerCase().replace(/[^a-z]/g, ''))
    }

    const handleInputSubmit = () => {
        const cleanWord = currentInput.trim().toLowerCase().replace(/[^a-z]/g, '')
        if (cleanWord.length > 0 && words.length < 12) {
            const newWords = [...words, cleanWord]
            setWords(newWords)
            setCurrentInput('')
            validateMnemonic(newWords)
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }
    }

    const handleKeyPress = ({ nativeEvent }: any) => {
        if (nativeEvent.key === 'Backspace' && currentInput === '' && words.length > 0) {
            const newWords = [...words]
            const lastWord = newWords.pop() || ''
            setWords(newWords)
            setCurrentInput(lastWord)
            validateMnemonic(newWords)
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }
    }

    const handlePillPress = (idx: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        const newWords = [...words]
        const clickedWord = newWords.splice(idx, 1)[0]
        setWords(newWords)
        setCurrentInput(clickedWord)
        validateMnemonic(newWords)
        // Focus the input to let them edit
        setTimeout(() => inputRef.current?.focus(), 50);
    }

    const handlePaste = async () => {
        try {
            const text = await Clipboard.getStringAsync()
            if (!text) return

            const pastedWords = text.trim().split(/\s+/).filter(w => w.length > 0).map(w => w.toLowerCase().replace(/[^a-z]/g, ''))
            if (pastedWords.length >= 12) {
                const newWords = pastedWords.slice(0, 12)
                setWords(newWords)
                setCurrentInput('')
                validateMnemonic(newWords)
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            } else {
                setError(`Found ${pastedWords.length} words, need 12.`)
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
            }
        } catch (e) {
            console.error('[ImportSeedStep] Paste error:', e)
        }
    }

    const handleClear = () => {
        setWords([])
        setCurrentInput('')
        setIsValid(false)
        setError(null)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    }

    const handleImport = () => {
        const mnemonic = words.map(w => w.trim().toLowerCase()).join(' ')
        if (bip39.validateMnemonic(mnemonic)) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
            onImport(mnemonic)
        }
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <YStack
                flex={1}
                bg="$background"
                px="$4"
                pt={insets.top + 8}
                pb={insets.bottom + 8}
            >
                <ScrollView flex={1} showsVerticalScrollIndicator={false}>
                    {/* Header */}
                    <YStack gap="$2" mb="$3" mt="$2">
                        <H2 fontSize="$8" fontWeight="800" letterSpacing={-0.5} color="$color">
                            Enter seed phrase
                        </H2>
                        <Text color="$gray10" fontSize="$3" lineHeight={20}>
                            If you’re using a seed phrase to import the wallet, separate each word with a space.
                        </Text>
                    </YStack>

                    {/* Action paste / clear button */}


                    {/* Word Tag Container (Variable Width Flow) */}
                    <XStack flexWrap="wrap" gap="$2" mb="$4">
                        {words.map((word, index) => (
                            <XStack
                                key={index}
                                bg="$gray4"
                                px="$3"
                                py="$2"
                                rounded="$3"
                                alignItems="center"
                                gap="$1.5"
                                borderWidth={0}
                                onPress={() => handlePillPress(index)}
                            >
                                <Text fontSize="$2" color="$gray8" fontWeight="600">
                                    {String(index + 1).padStart(2, '0')}
                                </Text>
                                <Text fontSize="$4" color="$color" fontWeight="600">
                                    {word}
                                </Text>
                            </XStack>
                        ))}

                        {/* Active Input Pill */}
                        {words.length < 12 && (
                            <XStack
                                bg="$background"
                                px="$3"
                                py="$1"
                                rounded="$3"
                                borderWidth={1.5}
                                borderColor="$accent10"
                                items="center"
                                gap="$1.5"
                                minWidth={100}
                            >
                                <Text fontSize="$2" color="$accent10" fontWeight="600">
                                    {String(words.length + 1).padStart(2, '0')}
                                </Text>
                                <Input
                                    ref={inputRef}
                                    flex={1}
                                    color="$color"
                                    value={currentInput}
                                    onChangeText={handleInputChange}
                                    onKeyPress={handleKeyPress}
                                    placeholder={words.length === 0 ? "word" : ""}
                                    placeholderTextColor="$gray8"
                                    autoFocus
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    borderWidth={0}
                                    bg="transparent"
                                    px="$0"
                                    py="$0"
                                    height={30}
                                    fontSize="$4"
                                    fontWeight="600"
                                    onSubmitEditing={handleInputSubmit}
                                    blurOnSubmit={false}
                                    unstyled
                                />
                            </XStack>
                        )}
                    </XStack>
                    <XStack justify="center" mb="$4">
                        {words.length > 0 ? (
                            <Button
                                size="$3"
                                chromeless
                                onPress={handleClear}
                                icon={<Trash2 size={16} color="$gray10" />}
                            >
                                <Text color="$gray10" fontWeight="600">Clear</Text>
                            </Button>
                        ) : (
                            <Button
                                size="$3"
                                borderWidth={1}
                                borderColor="$borderColor"
                                bg="$background"
                                rounded="$4"

                                icon={<ClipboardPaste size={16} color="$color" />}
                                onPress={handlePaste}
                            >
                                <Text fontWeight="600">Paste</Text>
                            </Button>
                        )}
                    </XStack>


                </ScrollView>
                {/* Status Messages */}
                {error && (
                    <XStack items="center" justify="center" gap="$2" mb="$2" px="$2">
                        <AlertCircle size={16} color="$red10" />
                        <Text color="$red10" fontSize="$3">{error}</Text>
                    </XStack>
                )}
                {isValid && (
                    <XStack items="center" justify="center" gap="$2" mb="$2" px="$2">
                        <CheckCircle2 size={16} color="$green10" />
                        <Text color="$green10" fontSize="$3" fontWeight="600">
                            Valid recovery phrase ✓
                        </Text>
                    </XStack>
                )}

                {/* Inline Consent Checkbox */}
                <XStack
                    gap="$2.5"
                    p="$2.5"
                    mb="$2"

                    bg="$gray2"
                    rounded="$4"
                    borderWidth={1.5}
                    borderColor={checkedConsent ? "$accent10" : "rgba(128,128,128,0.1)"}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setCheckedConsent(!checkedConsent);
                    }}
                    pressStyle={{ opacity: 0.95 }}
                    alignItems="center"
                >
                    <View
                        width={18}
                        height={18}
                        rounded="$1"
                        borderWidth={2}
                        borderColor={checkedConsent ? "$accent10" : "$gray8"}
                        bg={checkedConsent ? "$accent10" : "transparent"}
                        alignItems="center"
                        justifyContent="center"
                    >
                        {checkedConsent && <Check size={11} color="white" strokeWidth={4} />}
                    </View>
                    <YStack flex={1}>
                        <Text fontSize="$2" color="$gray10" lineHeight={15}>
                            I understand that my ecash is stored locally, mints hold the backing Bitcoin, and BeyWallet is not liable for lost funds.
                        </Text>
                    </YStack>
                </XStack>

                {/* Bottom Buttons block */}
                <YStack gap="$2" mt="$4">
                    {/* Confirm Button */}
                    <Button
                        size="$5"
                        theme={(isValid && checkedConsent) ? 'accent' : 'gray'}
                        width="100%"
                        onPress={handleImport}
                        disabled={!isValid || !checkedConsent}

                        fontSize="$5"
                        fontWeight="700"
                        rounded="$5"
                        pressStyle={(isValid && checkedConsent) ? { scale: 0.98, opacity: 0.9 } : undefined}
                        opacity={(isValid && checkedConsent) ? 1 : 0.5}

                
                    >
                        Confirm
                    </Button>

                    {/* Back Button */}
                    <Button
                        size="$4"
                        chromeless
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
                            onBack();
                        }}
                    >
                        <Text color="$gray10" fontSize="$3" fontWeight="600">Back</Text>
                    </Button>
                </YStack>
            </YStack>
        </KeyboardAvoidingView>
    )
}
