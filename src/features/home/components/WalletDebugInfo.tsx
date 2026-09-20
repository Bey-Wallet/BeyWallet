import React, { useEffect, useState } from 'react';
import { YStack, Text, Button, XStack, View, Separator } from 'tamagui';
import { useWalletStore } from '~/state/walletStore';
import { seedService } from '~/services/platform/seedService';
import { Shield, Coins, Link, RefreshCcw } from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';

export function WalletDebugInfo() {
  const { activeMintUrl, balance, isInitializing, initialize, refreshBalance, error } =
    useWalletStore();
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [showMnemonic, setShowMnemonic] = useState(false);

  useEffect(() => {
    const fetchMnemonic = async () => {
      const m = await seedService.getMnemonic();
      setMnemonic(m);
    };
    fetchMnemonic();
  }, []);

  const handleInitialize = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await initialize();
    const m = await seedService.getMnemonic();
    setMnemonic(m);
  };

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    refreshBalance();
  };

  return (
    <YStack
      gap="$4"
      width="100%"
      p="$4"
      bg="$background"
      rounded="$4"
      borderWidth={1}
      borderColor="$borderColor"
      mt="$4"
    >
      <XStack
        items="center"
        gap="$2"
        borderBottomWidth={1}
        borderColor="$borderColor"
        pb="$2"
        mb="$2"
      >
        <Shield size={20} color="$blue10" />
        <Text fontSize="$5" fontWeight="700">
          Wallet Debug Info
        </Text>
      </XStack>

      {error && (
        <YStack bg="$red3" p="$3" rounded="$3">
          <XStack items="center" gap="$2">
            <Shield size={16} color="$red10" />
            <Text color="$red11" fontSize="$3">
              {error}
            </Text>
          </XStack>
        </YStack>
      )}

      {mnemonic ? (
        <YStack gap="$3">
          <YStack gap="$1">
            <XStack items="center" gap="$2">
              <Coins size={16} color="$orange10" />
              <Text fontSize="$3" fontWeight="600" color="$gray11">
                Balance
              </Text>
            </XStack>
            <Text fontSize="$6" fontWeight="700" color="$color">
              {balance.toLocaleString()} SATS
            </Text>
          </YStack>

          <Separator />

          <YStack gap="$1">
            <XStack items="center" gap="$2">
              <Link size={16} color="$blue10" />
              <Text fontSize="$3" fontWeight="600" color="$gray11">
                Active Mint
              </Text>
            </XStack>
            <Text fontSize="$3" numberOfLines={1} ellipsizeMode="middle" color="$color">
              {activeMintUrl || 'None connected'}
            </Text>
          </YStack>

          <Separator />

          <YStack gap="$2">
            <XStack items="center" justify="space-between">
              <XStack items="center" gap="$2">
                <Shield size={16} color="$red10" />
                <Text fontSize="$3" fontWeight="600" color="$gray11">
                  Recovery Phrase
                </Text>
              </XStack>
              <Button size="$2" onPress={() => setShowMnemonic(!showMnemonic)}>
                {showMnemonic ? 'Hide' : 'Show'}
              </Button>
            </XStack>
            {showMnemonic && (
              <View
                bg="$backgroundHover"
                p="$3"
                rounded="$3"
                borderWidth={1}
                borderColor="$borderColor"
              >
                <Text fontSize="$2" fontFamily="$body" textAlign="center">
                  {mnemonic}
                </Text>
              </View>
            )}
          </YStack>

          <Button icon={<RefreshCcw size={16} />} size="$3" onPress={handleRefresh} mt="$2">
            Refresh Balance
          </Button>
        </YStack>
      ) : (
        <YStack gap="$4" items="center" py="$4">
          <Text textAlign="center" color="$gray11">
            No wallet found on this device.
          </Text>
          <Button theme="blue" size="$4" onPress={handleInitialize} disabled={isInitializing}>
            {isInitializing ? 'Creating Wallet...' : 'Create New Wallet'}
          </Button>
        </YStack>
      )}
    </YStack>
  );
}
