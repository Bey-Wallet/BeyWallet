import React from 'react'
import { router, Tabs } from 'expo-router'
import { Button, XStack, Text, useTheme, Image, H1 } from 'tamagui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  History,
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
  Search,
  Nfc,
  Bitcoin,
  Square,
  CopySlash,
  RectangleHorizontal
} from '@tamagui/lucide-icons'
import { useAppTheme } from '~/context/ThemeContext'
import { useAuthStore } from '~/store/authStore'
import HomeHeaderMintSelector from '~/components/HomeMintSelector'
import SettingsIcon from '~/components/icons/Settings'
import WalletIcon from '~/components/icons/Wallet'
import HistoryVolume from '~/components/HistoryVolume'
import LockIcon from '~/components/icons/Lock'
import NFCFillIcon from '~/components/icons/NFC-fill'
import * as Haptics from 'expo-haptics'
import HomeIcon from '~/components/icons/Home'

// Extracted to module scope + memoized so they aren't re-created on every render
const HeaderLeft = React.memo(({ resolvedTheme }: { resolvedTheme: string }) => (
  <XStack pl="$4" items="center">
    <Image
      source={resolvedTheme === 'dark'
        ? require('../../assets/icons/Frame 6.png')
        : require('../../assets/icons/Frame 5.png')}
      width={35}
      height={35}
      resizeMode="contain"
    />
  </XStack>
))

const DefaultHeaderTitle = React.memo(({ children }: { children: string }) => (
  <Text fontWeight="700" fontSize={20} color="$color">
    {children.charAt(0).toUpperCase() + children.slice(1)}
  </Text>
))

export default function TabLayout() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { resolvedTheme } = useAppTheme()
  const { lock } = useAuthStore()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.color.val,
        tabBarInactiveTintColor: theme.color4.val,
        headerShadowVisible: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: theme.background.val,
          borderTopColor: theme.borderColor.val,
          height: 60 + (insets.bottom > 0 ? insets.bottom : 20),
          paddingTop: 12,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 16,
        },
        headerStyle: {
          backgroundColor: theme.background.val,
          borderBottomColor: theme.borderColor.val,
        },
        headerTitle: ({ children }) => <DefaultHeaderTitle>{children as string}</DefaultHeaderTitle>,
        headerLeft: () => <HeaderLeft resolvedTheme={resolvedTheme} />,
        headerTitleAlign: 'center',
      }}
    >
      <Tabs.Screen
        name="index"
        listeners={{
          tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        }}
        options={{
          title: 'Home',
          headerTitle: () => <HomeHeaderMintSelector />,
          tabBarIcon: ({ color }) => <HomeIcon color={color as any} />,
          headerRight: () => (
            <XStack pr="$4" gap="$2">
              <Button
                circular
                size="$3"
                chromeless
                icon={<Scan strokeWidth={3} size={24} color="$color9" />}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  router.push({
                    pathname: '/(modals)/scanner',
                    params: { returnTo: '/receive' }
                  })
                }}
              />
              <Button
                circular
                size="$3"
                chromeless
                icon={<Nfc size={24} strokeWidth={3} color="$color9" />}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  router.push('/(modals)/nfc-receive')
                }}
              />
            </XStack>
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        listeners={{
          tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        }}
        options={{
          headerShown: false,
          title: 'Explore',
          tabBarIcon: ({ color }) => <Search strokeWidth={2.5} color={color as any} />,
          headerRight: () => (
            <XStack pr="$4">
              <Button
                circular
                size="$3"
                chromeless
                icon={<HelpCircle size={24} color="$color" />}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  console.log('Help')
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
          tabBarIcon: ({ color }) => <History strokeWidth={2.5} color={color as any} />,
          headerRight: () => (
            <XStack pr="$4">
              <HistoryVolume />
            </XStack>
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

          tabBarIcon: ({ color }) => <SettingsIcon color={color as any} />,
          headerRight: () => (
            <XStack pr="$4">
              <Button
                circular
                size="$3"
                chromeless
                icon={<HelpCircle size={24} color="$color" />}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  console.log('Help')
                }}
              />
            </XStack>
          ),
        }}
      />
    </Tabs>
  )
}
