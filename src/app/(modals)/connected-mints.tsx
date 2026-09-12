import React from 'react';
import { Button, ScrollView, XStack, YStack } from 'tamagui';
import { Stack } from 'expo-router';
import { ChevronLeft } from '@tamagui/lucide-icons';
import { Text } from 'tamagui';

const ConnectedMints = () => {
  return (
    <YStack flex={1} bg="$background">
      <Stack.Screen
        options={{
          headerTitle: 'Connected Mints',
          headerLeft: () => (
            <Button
              circular
              size="$3"
              bg="$gray3"
              pressStyle={{ scale: 0.95, bg: '$gray4' }}
              icon={<ChevronLeft size={20} color="$color" />}
              onPress={() => {}}
            />
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        gap="$2"
      >
        <YStack gap="$4">
          <YStack gap="$2">
            <Text fontWeight="bold" color="$accent3">
              Pinned Mints
            </Text>
            <XStack width="100%" rounded="$5" height={200} bg="$gray3"></XStack>
          </YStack>
          <YStack gap="$2">
            <Text fontWeight="bold" color="$accent3">
              Unpinned Mints
            </Text>
            <XStack width="100%" rounded="$5" height={200} bg="$gray3"></XStack>
          </YStack>
        </YStack>
      </ScrollView>
    </YStack>
  );
};

export default ConnectedMints;
