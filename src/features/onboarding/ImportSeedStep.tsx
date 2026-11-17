import { AppInput as Input } from '~/shared/ui/AppInput';
import { AppButton } from '~/shared/ui/AppButton';
import React, { useState, useRef, useEffect } from 'react';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import {
  CircleHelp,
  ClipboardPaste,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from '@tamagui/lucide-icons';
import * as Clipboard from 'expo-clipboard';
import * as bip39 from 'bip39';
import { BackHandler, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BUIHeader, BUIHeaderAction } from '~/shared/ui/BUI/BUIHeader';
import type { BUISheetRef } from '~/shared/ui/BUI/BUISheet';
import { InfoSheet } from '~/shared/components/info-sheets/InfoSheet';
import { ConsentStep } from './ConsentStep';
import { walletFileService } from '~/services/platform/walletFileService';

interface ImportSeedStepProps {
  isImporting?: boolean;
  onImport: (mnemonic: string) => void;
  onImportFromFile: (uri: string) => void | Promise<void>;
  onBack: () => void;
}

export function ImportSeedStep({
  onImport,
  onImportFromFile,
  onBack,
  isImporting = false,
}: ImportSeedStepProps) {
  const [words, setWords] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
  const [isPickingFile, setIsPickingFile] = useState(false);
  const pickingFile = useRef(false);
  const insets = useSafeAreaInsets();
  const inputRef = useRef<any>(null);
  const infoSheet = useRef<BUISheetRef>(null);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isImporting || isPickingFile) return true;
      Keyboard.dismiss();
      if (showConsent) {
        setShowConsent(false);
        setSelectedBackup(null);
      } else onBack();
      return true;
    });
    return () => subscription.remove();
  }, [isImporting, isPickingFile, showConsent, onBack]);

  const handleBack = () => {
    if (isImporting || isPickingFile) return;
    Keyboard.dismiss();
    if (showConsent) {
      setShowConsent(false);
      setSelectedBackup(null);
    } else onBack();
  };

  const validateMnemonic = (wordArray: string[]) => {
    if (wordArray.length < 12) {
      setIsValid(false);
      setError(null);
      return;
    }

    const mnemonic = wordArray.map((w) => w.trim().toLowerCase()).join(' ');
    if (bip39.validateMnemonic(mnemonic)) {
      setIsValid(true);
      setError(null);
    } else {
      setIsValid(false);
      setError('Invalid recovery phrase. Check your words and try again.');
    }
  };

  const handleInputChange = (text: string) => {
    // Handle paste or space-split words
    if (text.includes(' ')) {
      const parts = text.split(/\s+/).filter((w) => w.length > 0);
      if (parts.length > 1) {
        const newWords = [...words, ...parts]
          .slice(0, 12)
          .map((w) => w.toLowerCase().replace(/[^a-z]/g, ''));
        setWords(newWords);
        setCurrentInput('');
        validateMnemonic(newWords);

        return;
      } else if (parts.length === 1 && text.endsWith(' ')) {
        const cleanWord = parts[0].toLowerCase().replace(/[^a-z]/g, '');
        if (cleanWord.length > 0 && words.length < 12) {
          const newWords = [...words, cleanWord];
          setWords(newWords);
          setCurrentInput('');
          validateMnemonic(newWords);
        }
        return;
      }
    }
    setCurrentInput(text.toLowerCase().replace(/[^a-z]/g, ''));
  };

  const handleInputSubmit = () => {
    const cleanWord = currentInput
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, '');
    if (cleanWord.length > 0 && words.length < 12) {
      const newWords = [...words, cleanWord];
      setWords(newWords);
      setCurrentInput('');
      validateMnemonic(newWords);
    }
  };

  const handleKeyPress = ({ nativeEvent }: any) => {
    if (nativeEvent.key === 'Backspace' && currentInput === '' && words.length > 0) {
      const newWords = [...words];
      const lastWord = newWords.pop() || '';
      setWords(newWords);
      setCurrentInput(lastWord);
      validateMnemonic(newWords);
    }
  };

  const handlePillPress = (idx: number) => {
    const newWords = [...words];
    const clickedWord = newWords.splice(idx, 1)[0];
    setWords(newWords);
    setCurrentInput(clickedWord);
    validateMnemonic(newWords);
    // Focus the input to let them edit
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handlePaste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text) return;

      const pastedWords = text
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 0)
        .map((w) => w.toLowerCase().replace(/[^a-z]/g, ''));
      if (pastedWords.length >= 12) {
        const newWords = pastedWords.slice(0, 12);
        setWords(newWords);
        setCurrentInput('');
        validateMnemonic(newWords);
      } else {
        setError(`Found ${pastedWords.length} words, need 12.`);
      }
    } catch (e) {
      setError('Could not read the clipboard. Type your recovery phrase instead.');
    }
  };

  const handleClear = () => {
    setWords([]);
    setCurrentInput('');
    setIsValid(false);
    setError(null);
  };

  const handleImport = () => {
    if (isImporting) return;
    if (selectedBackup) {
      void onImportFromFile(selectedBackup);
      return;
    }
    const mnemonic = words.map((w) => w.trim().toLowerCase()).join(' ');
    if (bip39.validateMnemonic(mnemonic)) {
      onImport(mnemonic);
    }
  };

  const handleSelectBackup = async () => {
    if (isImporting || pickingFile.current) return;
    pickingFile.current = true;
    setIsPickingFile(true);
    setError(null);
    Keyboard.dismiss();
    try {
      const uri = await walletFileService.selectWalletBackupFile();
      setSelectedBackup(uri);
      setShowConsent(true);
    } catch (error) {
      if (!(error instanceof Error && error.message === 'File selection was cancelled.')) {
        setError('Could not select a backup file. Please try again.');
      }
    } finally {
      pickingFile.current = false;
      setIsPickingFile(false);
    }
  };

  if (showConsent) {
    return <ConsentStep onComplete={handleImport} onBack={handleBack} isBusy={isImporting} />;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <YStack flex={1} bg="$background" pb={insets.bottom + 8}>
        <BUIHeader
          title="Enter seed phrase"
          navigation="back"
          topInset={insets.top}
          onNavigate={handleBack}
          navigationDisabled={isImporting || isPickingFile}
          actions={
            <BUIHeaderAction
              label="Seed import information"
              disabled={isImporting || isPickingFile}
              onPress={() => infoSheet.current?.present()}
            >
              <CircleHelp size={22} color="$color" />
            </BUIHeaderAction>
          }
        />
        <YStack flex={1} px="$4">
          <ScrollView
            pointerEvents={isImporting ? 'none' : 'auto'}
            flex={1}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <YStack gap="$2" mb="$3" mt="$2">
              <Text color="$gray10" fontSize="$3" lineHeight={18}>
                If you’re using a seed phrase to import the wallet, separate each word with a space.
              </Text>
            </YStack>

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
                    placeholder={words.length === 0 ? 'word' : ''}
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
                    fontFamily="$body"
                  />
                </XStack>
              )}
            </XStack>
            <XStack justify="center" mb="$4">
              {words.length > 0 ? (
                <AppButton
                  disabled={isImporting}
                  variant="default"
                  emphasis="secondary"
                  size="xsmall"
                  icon={<Trash2 size={16} color="$gray10" />}
                  onPress={handleClear}
                >
                  Clear
                </AppButton>
              ) : (
                <AppButton
                  disabled={isImporting}
                  variant="default"
                  emphasis="secondary"
                  size="xsmall"
                  icon={<ClipboardPaste size={16} color="$color" />}
                  onPress={handlePaste}
                >
                  Paste
                </AppButton>
              )}
            </XStack>
          </ScrollView>
          {/* Status Messages */}
          {error && (
            <XStack items="center" justify="center" gap="$2" mb="$2" px="$2">
              <AlertCircle size={16} color="$red10" />
              <Text color="$red10" fontSize="$3">
                {error}
              </Text>
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

          {/* Bottom Buttons block */}
          <YStack gap="$2" mt="$4">
            {/* Confirm Button */}
            <AppButton
              variant="default"
              emphasis="primary"
              size="large"
              width="100%"
              onPress={() => {
                if (isImporting || isPickingFile || !isValid) return;
                Keyboard.dismiss();
                setShowConsent(true);
              }}
              loading={isImporting}
              loadingText="Importing wallet…"
              disabled={isImporting || isPickingFile || !isValid}
            >
              Continue
            </AppButton>
            <AppButton
              emphasis="text"
              size="small"
              minHeight={48}
              disabled={isImporting || isPickingFile}
              loading={isPickingFile}
              loadingText="Selecting backup…"
              onPress={handleSelectBackup}
            >
              Import backup file
            </AppButton>
          </YStack>
        </YStack>
        <InfoSheet ref={infoSheet} topic="import-seed" busy={isImporting} />
      </YStack>
    </KeyboardAvoidingView>
  );
}
