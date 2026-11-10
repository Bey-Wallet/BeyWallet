import {
  AtSign,
  Banknote,
  Bitcoin,
  CircleHelp,
  Coins,
  DatabaseBackup,
  CloudUpload,
  EyeOff,
  FileDown,
  FileUp,
  Fingerprint,
  Globe,
  Info,
  KeyRound,
  Palette,
  RefreshCw,
  ScanSearch,
  Landmark,
  Network,
  HeartPulse,
  History,
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
import { isDevelopmentClient } from '~/shared/utils/developmentClient';
import type { AppButtonIcon } from '~/shared/ui/AppButton';

export type SettingsItem = {
  path: string;
  title: string;
  icon: AppButtonIcon;
  destructive?: boolean;
};
export const settingsCategories = {
  preferences: {
    title: 'Appearance',
    icon: SlidersHorizontal,
    groups: [
      [
        { path: 'theme', title: 'Theme', icon: Palette },
        { path: 'currency', title: 'Fiat currency', icon: Banknote },
        { path: 'bitcoin-symbol', title: 'Bitcoin symbol', icon: Bitcoin },
      ],
    ],
  },
  security: {
    title: 'Privacy & security',
    icon: ShieldCheck,
    groups: [
      [
        { path: 'app-lock', title: 'Biometric app lock', icon: Fingerprint },
        { path: 'hide-balance', title: 'Hide balance', icon: EyeOff },
      ],
      [
        { path: 'receiving-policy', title: 'Receiving from people', icon: UserRound },
        { path: 'blocked-people', title: 'Blocked people', icon: UserRoundX },
      ],
      [{ path: 'secret-key', title: 'Nostr secret key', icon: KeyRound }],
      [{ path: 'delete-wallet', title: 'Delete wallet', icon: Trash2, destructive: true }],
    ],
  },
  backup: {
    title: 'Backup & recovery',
    icon: DatabaseBackup,
    groups: [
      [
        { path: 'recovery-phrase', title: 'Recovery phrase', icon: ShieldCheck },
        { path: 'mint-backup', title: 'Mint-list backup', icon: CloudUpload },
        { path: 'export-backup', title: 'Export wallet backup', icon: FileUp },
      ],
      [
        { path: 'restore-backup', title: 'Restore wallet backup', icon: FileDown },
        { path: 'recover-funds', title: 'Recover funds', icon: ScanSearch },
      ],
    ],
  },
  wallet: {
    title: 'Payments & mints',
    icon: Wallet,
    groups: [
      [
        { path: 'mints', title: 'Connected mints', icon: Landmark },
        { path: 'fallback-mint', title: 'Fallback mint', icon: Pin },
        { path: 'lightning-address', title: 'Lightning address', icon: AtSign },
        { path: 'get-change', title: 'Prepare offline change', icon: RefreshCw },
      ],
    ],
  },
  nostr: {
    title: 'Network',
    icon: Network,
    groups: [
      [
        { path: 'relays', title: 'Relays', icon: Network },
        { path: 'nostr-history', title: 'Nostr history', icon: History },
        { path: 'nostr-health', title: 'Nostr health', icon: HeartPulse },
      ],
    ],
  },
  advanced: {
    title: 'Wallet tools',
    icon: Wrench,
    groups: [
      [{ path: 'optimize-wallet', title: 'Optimize wallet', icon: Sparkles }],
      [
        { path: 'proofs', title: 'Proof manager', icon: Coins },
        { path: 'verify-proofs', title: 'Verify proofs offline', icon: ShieldCheck },
      ],
      ...(isDevelopmentClient() ? [[{ path: 'new-ui', title: 'BUI', icon: Sparkles }]] : []),
    ],
  },
  identity: {
    title: 'Profile & addresses',
    icon: UserRound,
    groups: [
      [
        { path: 'profile', title: 'My addresses', icon: UserRound },
        { path: 'username', title: 'Nostr username', icon: AtSign },
        { path: 'public-key', title: 'Public Nostr key', icon: KeyRound },
      ],
    ],
  },
} satisfies Record<string, { title: string; icon: AppButtonIcon; groups: SettingsItem[][] }>;

export type SettingsCategory = keyof typeof settingsCategories;
export const settingsTitles: Record<string, string> = {
  index: 'Settings',
  help: 'Help & support',
  diagnostics: 'Diagnostic report',
  about: 'About Bey Wallet',
  supporter: 'Support Bey',
  updates: 'App updates',
  notifications: 'Notifications',
  'new-ui-buttons': 'BUI · Buttons',
  'new-ui-colors': 'BUI · Theme & colors',
  'bui-layout': 'BUI · Layout & spacing',
  'bui-typography': 'BUI · Typography',
  'bui-icons-avatars': 'BUI · Icons & avatars',
  'bui-badges': 'BUI · Badges',
  'bui-forms': 'BUI · Inputs & forms',
  'bui-selections': 'BUI · Selection controls',
  'bui-tabs-chips': 'BUI · Tabs, chips & selectors',
  'bui-lists': 'BUI · Lists & rows',
  'bui-cards': 'BUI · Cards',
  'bui-navigation': 'BUI · Headers & navigation',
  'bui-sheets': 'BUI · Sheets & dialogs',
  'bui-menus': 'BUI · Menus & tooltips',
  ...Object.fromEntries(
    Object.entries(settingsCategories).map(([key, value]) => [key, value.title]),
  ),
  ...Object.fromEntries(
    Object.values(settingsCategories).flatMap((value) =>
      value.groups.flatMap((group) => group.map((item) => [item.path, item.title])),
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
