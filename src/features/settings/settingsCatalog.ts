import {
  AtSign,
  Banknote,
  Bell,
  Bitcoin,
  CircleHelp,
  Coins,
  DatabaseBackup,
  EyeOff,
  FileDown,
  FileUp,
  Fingerprint,
  Globe,
  Info,
  KeyRound,
  Palette,
  RefreshCw,
  Landmark,
  Network,
  HeartPulse,
  Pin,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserRound,
  UserRoundX,
  Wallet,
  Wrench,
  Github,
  BookOpen,
} from '@tamagui/lucide-icons';
import NostrIcon from '~/shared/icons/NostrIcon';
import type { AppButtonIcon } from '~/shared/ui/AppButton';

export type SettingsItem = {
  path: string;
  title: string;
  icon: AppButtonIcon;
  destructive?: boolean;
};
export const settingsCategories = {
  preferences: {
    title: 'Preferences',
    icon: SlidersHorizontal,
    items: [
      { path: 'theme', title: 'Theme', icon: Palette },
      { path: 'display-unit', title: 'Primary display unit', icon: Coins },
      { path: 'currency', title: 'Secondary currency', icon: Banknote },
      { path: 'bitcoin-symbol', title: 'Bitcoin symbol', icon: Bitcoin },
      { path: 'notifications', title: 'Notifications', icon: Bell },
    ],
  },
  security: {
    title: 'Security & privacy',
    icon: ShieldCheck,
    items: [
      { path: 'app-lock', title: 'Biometric app lock', icon: Fingerprint },
      { path: 'hide-balance', title: 'Hide balance', icon: EyeOff },
      { path: 'blocked-people', title: 'Blocked people', icon: UserRoundX },
      { path: 'secret-key', title: 'Nostr secret key', icon: KeyRound },
      { path: 'delete-wallet', title: 'Delete wallet', icon: Trash2, destructive: true },
    ],
  },
  backup: {
    title: 'Backup & recovery',
    icon: DatabaseBackup,
    items: [
      { path: 'recovery-phrase', title: 'Recovery phrase', icon: ShieldCheck },
      { path: 'export-backup', title: 'Export wallet backup', icon: FileUp },
      { path: 'restore-backup', title: 'Restore wallet backup', icon: FileDown },
    ],
  },
  wallet: {
    title: 'Wallet & payments',
    icon: Wallet,
    items: [
      { path: 'mints', title: 'Connected mints', icon: Landmark },
      { path: 'fallback-mint', title: 'Fallback mint', icon: Pin },
      { path: 'get-change', title: 'Prepare offline change', icon: RefreshCw },
      { path: 'optimize-wallet', title: 'Optimize wallet', icon: Sparkles },
    ],
  },
  nostr: {
    title: 'Nostr & connections',
    icon: NostrIcon,
    items: [
      { path: 'receiving-policy', title: 'Receiving from people', icon: UserRound },
      { path: 'relays', title: 'Relays', icon: Network },
      { path: 'nostr-health', title: 'Nostr health', icon: HeartPulse },
    ],
  },
  advanced: {
    title: 'Advanced',
    icon: Wrench,
    items: [
      { path: 'proofs', title: 'Proof manager', icon: Coins },
      { path: 'verify-proofs', title: 'Verify proofs offline', icon: ShieldCheck },
    ],
  },
  identity: {
    title: 'Profile & identity',
    icon: UserRound,
    items: [
      { path: 'profile', title: 'Profile', icon: UserRound },
      { path: 'username', title: 'Nostr username', icon: AtSign },
      { path: 'public-key', title: 'Public key', icon: KeyRound },
    ],
  },
} satisfies Record<string, { title: string; icon: AppButtonIcon; items: SettingsItem[] }>;

export type SettingsCategory = keyof typeof settingsCategories;
export const settingsTitles: Record<string, string> = {
  index: 'Settings',
  help: 'Help & support',
  about: 'About Bey Wallet',
  updates: 'App updates',
  ...Object.fromEntries(
    Object.entries(settingsCategories).map(([key, value]) => [key, value.title]),
  ),
  ...Object.fromEntries(
    Object.values(settingsCategories).flatMap((value) =>
      value.items.map((item) => [item.path, item.title]),
    ),
  ),
};

export const settingsLinks = {
  website: 'https://bey.cash',
  github: 'https://github.com/Bey-Wallet/BeyWallet',
  support: 'https://github.com/Bey-Wallet/BeyWallet/issues',
  documentation: 'https://github.com/Bey-Wallet/BeyWallet#readme',
  legal: 'https://bey.cash/privacy-policy',
};
export const settingsLinkIcons = {
  website: Globe,
  github: Github,
  support: CircleHelp,
  documentation: BookOpen,
};
export { CircleHelp, Info };
