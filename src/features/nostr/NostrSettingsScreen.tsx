import React, { useEffect, useState } from 'react';
import { YStack, Text, XStack, Button, Separator, View, ScrollView, Image } from 'tamagui';
import {
  Key,
  Copy,
  Eye,
  EyeOff,
  Server,
  AlertTriangle,
  ShieldAlert,
  Activity,
  ChevronRight,
} from '@tamagui/lucide-icons';
import { Stack, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useToastController } from '@tamagui/toast';
import { biometricService } from '~/services/platform/biometricService';
import { useSettingsStore } from '~/state/settingsStore';
import { SafeFlex } from '~/shared/ui/Flex';
import {
  nostrDiagnosticsService,
  type NostrDiagnosticSnapshot,
} from '~/services/wallet/nostrDiagnosticsService';
import { RELAYS } from '~/services/wallet/nostrService';

export default function NostrSettingsScreen() {
  const toast = useToastController();
  const router = useRouter();
  const npub = useSettingsStore((state) => state.npub);
  const nsec = useSettingsStore((state) => state.nsec);
  const [isNsecVisible, setIsNsecVisible] = useState(false);

  const [diagnostics, setDiagnostics] = useState<NostrDiagnosticSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    void nostrDiagnosticsService.getDiagnostics().then((snapshot) => {
      if (!cancelled) setDiagnostics(snapshot);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCopy = async (text: string | null, type: 'npub' | 'nsec' | 'relay') => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    toast.show(`Copied ${type} to clipboard`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleRevealNsec = async () => {
    if (isNsecVisible) {
      setIsNsecVisible(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    const success = await biometricService.authenticateAsync(
      'Authenticate to view your secret nsec',
    );
    if (success) {
      setIsNsecVisible(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const truncateKey = (str: string | null) => {
    if (!str || str.length < 24) return str;
    return `${str.slice(0, 16)}...${str.slice(-12)}`;
  };

  return (
    <SafeFlex fill bg="$background">
      <Stack.Screen options={{ headerTitle: 'Nostr Settings' }} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        <YStack p="$4" gap="$5">
          {/* Header */}
          <XStack items="center" gap="$3" py="$2">
            <View p="$2" bg="white" rounded="$5">
              <Image
                src={require('~/assets/images/nostr-icon-black-transparent.png')}
                width={36}
                height={36}
                resizeMode="contain"
                alt=""
              />
            </View>
            <YStack>
              <Text fontSize="$5" fontWeight="900" color="$color">
                Nostr Keys
              </Text>
              <Text fontSize="$2" color="$gray10">
                Manage your public and private credentials
              </Text>
            </YStack>
          </XStack>

          {/* Keys Section */}
          <YStack gap="$4">
            {/* NPUB Card */}
            <XStack
              justify="space-between"
              items="center"
              width="100%"
              bg="$gray3"
              p="$4"
              rounded="$6"
              minH={70}
            >
              <XStack gap="$3" items="center" flex={1} mr="$2">
                <Key size={20} color="$accent5" strokeWidth={2.5} />
                <YStack flex={1} justify="center">
                  <Text
                    fontSize="$1"
                    fontWeight="800"
                    color="$gray10"
                    textTransform="uppercase"
                    mb="$1"
                  >
                    Public Key (npub)
                  </Text>
                  <Text fontSize="$4" fontWeight="800" color="$accent5" numberOfLines={1}>
                    {npub ? truncateKey(npub) : 'Loading...'}
                  </Text>
                </YStack>
              </XStack>
              <Button
                size="$3"
                circular
                chromeless
                icon={<Copy size={16} color="$accent5" strokeWidth={2.5} />}
                onPress={() => handleCopy(npub, 'npub')}
              />
            </XStack>

            {/* NSEC Card */}
            <YStack gap="$2.5">
              <XStack
                justify="space-between"
                items="center"
                width="100%"
                bg="$red3"
                p="$4"
                rounded="$6"
                minH={70}
              >
                <XStack gap="$3" items="center" flex={1} mr="$2">
                  <ShieldAlert size={20} color="$red10" strokeWidth={2.5} />
                  <YStack flex={1} justify="center">
                    <Text
                      fontSize="$1"
                      fontWeight="800"
                      color="$red9"
                      textTransform="uppercase"
                      mb="$1"
                    >
                      Secret Key (nsec)
                    </Text>
                    <Text
                      fontSize={isNsecVisible ? '$2' : '$4'}
                      fontWeight="800"
                      color="$red10"
                      numberOfLines={1}
                      style={isNsecVisible ? { fontSize: 13 } : { lineHeight: 20 }}
                    >
                      {isNsecVisible ? truncateKey(nsec) : '••••••••••••••••••••••••••••••••'}
                    </Text>
                  </YStack>
                </XStack>
                <XStack gap="$1">
                  {isNsecVisible && (
                    <Button
                      size="$3"
                      circular
                      chromeless
                      icon={<Copy size={16} color="$red10" strokeWidth={2.5} />}
                      onPress={() => handleCopy(nsec, 'nsec')}
                    />
                  )}
                  <Button
                    size="$3"
                    circular
                    chromeless
                    icon={
                      isNsecVisible ? (
                        <EyeOff size={16} color="$red10" strokeWidth={2.5} />
                      ) : (
                        <Eye size={16} color="$red10" strokeWidth={2.5} />
                      )
                    }
                    onPress={handleRevealNsec}
                  />
                </XStack>
              </XStack>
              <XStack gap="$2" items="center" px="$2">
                <AlertTriangle size={14} color="$red10" />
                <Text fontSize="$2" color="$red10" fontWeight="600">
                  Never share your nsec with anyone.
                </Text>
              </XStack>
            </YStack>
          </YStack>

          <Separator borderColor="$borderColor" opacity={0.5} my="$2" />

          <Button
            height="auto"
            p="$4"
            bg="$gray3"
            rounded="$6"
            onPress={() => router.push('/(modals)/nostr-diagnostics')}
          >
            <XStack flex={1} items="center" gap="$3">
              <Activity
                size={22}
                color={
                  diagnostics?.overall === 'healthy'
                    ? '$green10'
                    : diagnostics?.overall === 'unhealthy'
                      ? '$red10'
                      : '$yellow10'
                }
              />
              <YStack flex={1} items="flex-start">
                <Text fontWeight="900">Nostr health</Text>
                <Text color="$gray10" fontSize="$2">
                  {diagnostics ? diagnostics.overall : 'Checking…'}
                </Text>
              </YStack>
              <ChevronRight size={18} color="$gray9" />
            </XStack>
          </Button>

          {/* Relays Section */}
          <YStack gap="$4">
            <XStack items="center" gap="$3">
              <View p="$2.5" bg="$accent4" rounded="$5">
                <Server size={22} color="$accent10" strokeWidth={2.5} />
              </View>
              <YStack>
                <Text fontSize="$5" fontWeight="900" color="$color">
                  Relays
                </Text>
                <Text fontSize="$2" color="$gray10">
                  Connect to the decentralized Nostr network
                </Text>
              </YStack>
            </XStack>

            {/* Relay List */}
            <YStack gap="$2.5" mt="$1">
              {RELAYS.map((relay) => {
                const reachable = diagnostics?.relays.find((item) => item.url === relay)?.reachable;
                return (
                  <XStack
                    key={relay}
                    bg="$gray3"
                    px="$4"
                    py="$3.5"
                    rounded="$6"
                    items="center"
                    justify="space-between"
                  >
                    <XStack gap="$3" items="center" flex={1} mr="$2">
                      <View
                        width={6}
                        height={6}
                        rounded={3}
                        bg={
                          reachable === true ? '$green9' : reachable === false ? '$red9' : '$gray8'
                        }
                      />
                      <Text
                        fontSize="$3"
                        fontWeight="800"
                        color="$color"
                        numberOfLines={1}
                        flex={1}
                      >
                        {relay}
                      </Text>
                    </XStack>
                    <Text fontSize="$2" color="$gray9">
                      {reachable === true
                        ? 'Connected'
                        : reachable === false
                          ? 'Unavailable'
                          : 'Checking'}
                    </Text>
                  </XStack>
                );
              })}
            </YStack>
          </YStack>
        </YStack>
      </ScrollView>
    </SafeFlex>
  );
}
