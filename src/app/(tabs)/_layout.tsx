import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import { nfcFlow } from '~/features/nfc/nfcFlow';
import React from 'react';
import { router, Tabs } from 'expo-router';
import { XStack, Text, useTheme, H1 } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Clock, Nfc, AtSign } from '@tamagui/lucide-icons';
import { useAppTheme } from '~/shared/theme/ThemeContext';
import { useAuthStore } from '~/state/authStore';
import HomeHeaderMintSelector from '~/shared/ui/HomeMintSelector';
import SettingsIcon from '~/shared/icons/Settings';
import WalletIcon from '~/shared/icons/Wallet';
import BeyIcon from '~/shared/icons/BeyIcon';
import LockIcon from '~/shared/icons/Lock';
import NFCFillIcon from '~/shared/icons/NFC-fill';
import * as Haptics from 'expo-haptics';
import HomeIcon from '~/shared/icons/Home';
import Blockies from '~/shared/ui/Blockies';
import { useSettingsStore } from '~/state/settingsStore';
import { CustomTabBar } from '~/shared/ui/CustomTabBar';
import { appDimensions, appSpacing } from '~/shared/theme/appearance';

// Extracted to module scope + memoized so they aren't re-created on every render
const HeaderLeft = React.memo(({ resolvedTheme }: { resolvedTheme: string }) => (
  <XStack
    width={appDimensions.touchTarget + appSpacing.page}
    height={appDimensions.touchTarget}
    pl={appSpacing.page}
    items="center"
  >
    <AppPressable
      accessibilityRole="button"
      accessibilityLabel="My addresses"
      minHeight={appDimensions.touchTarget}
      width={appDimensions.touchTarget}
      pressStyle={{ opacity: 0.7, scale: 0.95 }}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push('/(modals)/nostr-profile');
      }}
      items="center"
      justify="center"
    >
      <Blockies
        style={{ borderRadius: 9 }}
        seed={useSettingsStore((state) => state.npub) || 'bey-cash'}
        size={10}
        scale={3.3}
      />
    </AppPressable>
  </XStack>
));

const DefaultHeaderTitle = React.memo(({ children }: { children: string }) => (
  <Text fontWeight="700" fontSize="$7" color="$color">
    {children.charAt(0).toUpperCase() + children.slice(1)}
  </Text>
));

export default function TabLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { resolvedTheme } = useAppTheme();
  const { lock } = useAuthStore();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: theme.color?.val,
        tabBarInactiveTintColor: theme.color4?.val,
        headerShadowVisible: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          display: 'none',
        },
        headerStyle: {
          backgroundColor: theme.background?.val,
          borderBottomColor: theme.borderColor?.val,
        },
        headerTitle: ({ children }) => (
          <DefaultHeaderTitle>{children as string}</DefaultHeaderTitle>
        ),
        headerTitleAlign: 'left',
      }}
    >
      <Tabs.Screen
        name="index"
        listeners={{
          tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        }}
        options={{
          title: 'Home',
          headerTitleAlign: 'center',
          headerLeft: () => <HeaderLeft resolvedTheme={resolvedTheme} />,
          headerTitle: () => <HomeHeaderMintSelector />,
          tabBarIcon: ({ color, size }) => <BeyIcon size={size} color={color} />,
          headerRight: () => (
            <XStack
              width={appDimensions.touchTarget + appSpacing.page}
              height={appDimensions.touchTarget}
              pr={appSpacing.page}
              items="center"
              justify="center"
            >
              <HeaderIconButton
                accessibilityLabel="Open NFC"
                icon={<Nfc />}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  nfcFlow.openReader();
                }}
              />
            </XStack>
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        listeners={{
          tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        }}
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => (
            <Clock size={size} strokeWidth={2.5} color={color as any} />
          ),
        }}
      />

      <Tabs.Screen
        name="people"
        listeners={{
          tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        }}
        options={{
          title: 'People',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <AtSign size={size} strokeWidth={2.5} color={color as any} />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        listeners={{
          tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        }}
        options={{
          title: 'Settings',
          headerShown: false,

          tabBarIcon: ({ color, size }) => <SettingsIcon size={size} color={color as any} />,
        }}
      />
    </Tabs>
  );
}
