import React from 'react';
import { router, Tabs } from 'expo-router';
import { Button, XStack, Text, useTheme, H1 } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Clock,
  Settings,
  Home,
  Scan,
  Lock,
  HelpCircle,
  Filter,
  ChevronDown,
  Sprout,
  Globe,
  ArrowLeft,
  Compass,
  Nfc,
  Bitcoin,
  Square,
  CopySlash,
  RectangleHorizontal,
  Users,
} from '@tamagui/lucide-icons';
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

// Extracted to module scope + memoized so they aren't re-created on every render
const HeaderLeft = React.memo(({ resolvedTheme }: { resolvedTheme: string }) => (
  <XStack
    pressStyle={{ opacity: 0.7, scale: 0.95 }}
    onPress={() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push('/(modals)/nostr-profile');
    }}
    items="center"
    pl="$4"
  >
    <Blockies
      style={{ borderRadius: 5 }}
      seed={useSettingsStore((state) => state.npub) || 'bey-cash'}
      size={10}
      scale={3.3}
    />
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
          tabBarIcon: ({ color }) => <BeyIcon size={24} color={color} />,
          headerRight: () => (
            <XStack pr="$4" gap="$2">
              <Button
                circular
                size="$3"
                chromeless
                icon={<Nfc size={24} />}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/(modals)/nfc-receive');
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
          tabBarIcon: ({ color }) => <Clock size={24} strokeWidth={2.5} color={color as any} />,
        }}
      />

      <Tabs.Screen
        name="contacts"
        listeners={{
          tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        }}
        options={{
          title: 'People',
          tabBarIcon: ({ color }) => <Users size={24} strokeWidth={2.5} color={color as any} />,
        }}
      />

      <Tabs.Screen
        name="settings"
        listeners={{
          tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        }}
        options={{
          title: 'Settings',

          tabBarIcon: ({ color }) => <SettingsIcon size={24} color={color as any} />,
        }}
      />
    </Tabs>
  );
}
