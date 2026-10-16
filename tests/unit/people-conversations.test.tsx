import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { nip19 } from 'nostr-tools';
import PeopleScreen from '~/features/people';
import ConversationScreen from '~/features/people/ConversationScreen';
import { usePeopleStore } from '~/state/peopleStore';
import { useNostrInboxStore } from '~/state/nostrInboxStore';
import { useMessageStore } from '~/state/messageStore';
import { useNostrReceiveSettingsStore } from '~/state/nostrReceiveSettingsStore';
import { nostrService } from '~/services/wallet/nostrService';
import type { ChatMessage } from '~/storage/sqlite/repositories/MessageRepository';
import { useSettingsStore } from '~/state/settingsStore';
import { Alert } from 'react-native';
import { applyIncomingContactPolicy } from '~/services/wallet/contactPolicy';

const alice = nip19.npubEncode('01'.repeat(32));
const bob = nip19.npubEncode('02'.repeat(32));
const eve = nip19.npubEncode('03'.repeat(32));
const mockPush = jest.fn();
const mockParams = { npub: bob };
let mockSavedMessages: ChatMessage[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));
jest.mock('tamagui', () =>
  Object.fromEntries(
    ['Input', 'Image', 'ScrollView', 'Text', 'View', 'XStack', 'YStack', 'Spinner'].map((name) => [
      name,
      name,
    ]),
  ),
);
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'AppPressable' }));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'AppIconButton' }));
jest.mock('@tamagui/lucide-icons', () =>
  Object.fromEntries(
    [
      'Search',
      'ClipboardPaste',
      'Users',
      'X',
      'AlertTriangle',
      'ArrowLeft',
      'ArrowUp',
      'ArrowUpRight',
      'ArrowDownLeft',
      'Copy',
      'RefreshCw',
      'Share2',
      'Trash2',
      'UserX',
      'AlertCircle',
      'Check',
      'Clock3',
      'Zap',
      'WalletCards',
    ].map((name) => [name, () => null]),
  ),
);
jest.mock('~/shared/ui/Blockies', () => 'Blockies');
jest.mock('~/shared/icons/Nip05VerifiedBadge', () => 'VerifiedBadge');
jest.mock('@gorhom/bottom-sheet', () => ({ BottomSheetScrollView: 'SheetScrollView' }));
jest.mock('~/shared/ui/AppBottomSheet', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef(({ children }: any, ref: any) => {
      const [open, setOpen] = React.useState(false);
      React.useImperativeHandle(ref, () => ({
        present: () => setOpen(true),
        dismiss: () => setOpen(false),
      }));
      return React.createElement('AppBottomSheet', { open }, open ? children : null);
    }),
  };
});
jest.mock('~/state/settingsStore', () => ({
  useSettingsStore: require('zustand').create(() => ({
    primaryCurrency: 'SATS',
    secondaryCurrency: 'USD',
    showBitcoinSymbol: false,
  })),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: any) => ({
    data: queryKey[0] === 'bitcoinPrice' ? { price: 60000 } : [],
  }),
}));
jest.mock('~/features/people/hooks/useNostrProfileSearch', () => ({
  useNostrProfileSearch: () => ({ results: [], isSearching: false }),
}));
jest.mock('~/features/people/peopleProfileCache', () => ({
  hydrateSavedPeople: jest.fn(async () => undefined),
  hydrateSavedPerson: jest.fn(async () => undefined),
  needsNostrProfileRefresh: () => false,
}));
jest.mock('~/features/people/components/NostrProfileItem', () => ({
  NostrProfileItem: 'ProfileRow',
  getNostrProfileLabel: (profile: any) => profile.displayName,
}));
jest.mock('~/services/wallet/historyService', () => ({
  historyService: { getHistory: jest.fn() },
}));
jest.mock('~/services/wallet/nostrService', () => ({
  nostrService: { sendChat: jest.fn(), retryChat: jest.fn() },
}));
jest.mock('~/services/wallet/nostrClaimService', () => ({
  nostrClaimService: { processPending: jest.fn(async () => undefined) },
}));
jest.mock('~/services/wallet/initService', () => ({
  initService: {
    getRepo: () => ({
      messageRepository: {
        page: jest.fn(async () => mockSavedMessages),
        markRead: jest.fn(async () => undefined),
      },
    }),
  },
}));
jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
}));

describe('People conversations and invitations', () => {
  let tree: ReactTestRenderer;
  beforeEach(() => {
    useSettingsStore.setState({ primaryCurrency: 'SATS', secondaryCurrency: 'USD' });
    mockSavedMessages = [];
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 0;
    });
    usePeopleStore.setState({ people: {} });
    useNostrInboxStore.setState({ items: [] });
    useMessageStore.setState({ recent: [], unread: {}, revision: 0 });
    useNostrReceiveSettingsStore.setState({ policy: 'ask' });
    usePeopleStore
      .getState()
      .savePerson({ npub: alice, displayName: 'Alice', contactStatus: 'accepted' });
    usePeopleStore
      .getState()
      .savePerson({ npub: bob, displayName: 'Bob', contactStatus: 'unaccepted' });
    usePeopleStore
      .getState()
      .savePerson({ npub: eve, displayName: 'Eve', contactStatus: 'blocked' });
    for (const id of ['offer-1', 'offer-2'])
      useNostrInboxStore.getState().addIncoming({
        id,
        tokenString: 'cashuBsynthetic-secret',
        amount: 5,
        mintUrl: 'https://mint.example',
        senderPubkey: '02'.repeat(32),
      });
  });
  afterEach(async () => {
    if (tree) await act(async () => tree.unmount());
    jest.restoreAllMocks();
  });

  it('has two tabs and counts one invitation for multiple offers without including blocked people', async () => {
    await act(async () => {
      tree = create(<PeopleScreen />);
    });
    const text = tree!.root
      .findAllByType('Text' as any)
      .map((node) => node.children.filter((child) => typeof child === 'string').join(''));
    expect(text).toContain('Recent (1)');
    expect(text).toContain('Requests (1)');
    expect(text).not.toContain('Favorites');
    const rows = tree!.root.findAllByType('ProfileRow' as any);
    expect(rows.map((row) => row.props.profile.npub)).toEqual([alice, bob]);
  });

  it('shows unknown payments as pending acceptance and enables the composer only after accepting', async () => {
    await act(async () => {
      tree = create(<ConversationScreen />);
    });
    expect(tree!.root.findAllByType('Input' as any)).toHaveLength(0);
    expect(JSON.stringify(tree!.toJSON())).toContain('Pending contact acceptance');
    expect(JSON.stringify(tree!.toJSON())).not.toContain('cashuBsynthetic-secret');
    const accept = tree!.root
      .findAllByType('AppButton' as any)
      .find((node) => node.props.children === 'Accept')!;
    await act(async () => {
      await accept.props.onPress();
    });
    expect(usePeopleStore.getState().people[bob].contactStatus).toBe('accepted');
    expect(tree!.root.findAllByType('Input' as any)).toHaveLength(1);
  });

  it('keeps blocked conversations without a composer or enabled payment actions', async () => {
    usePeopleStore.getState().setContactStatus(bob, 'blocked');
    await act(async () => {
      tree = create(<ConversationScreen />);
    });
    expect(tree!.root.findAllByType('Input' as any)).toHaveLength(0);
    const sendMoney = tree!.root
      .findAllByType('AppButton' as any)
      .find((node) => node.props.children === 'Pay')!;
    expect(sendMoney.props.disabled).toBe(true);
  });

  it('opens contact actions in a sheet with the full address and no QR action', async () => {
    usePeopleStore.getState().savePerson({
      npub: bob,
      nip05: 'bob@example.com',
      picture: 'https://example.com/bob.png',
      nip05Verified: true,
    });
    await act(async () => {
      tree = create(<ConversationScreen />);
    });
    const header = tree!.root
      .findAllByType('AppPressable' as any)
      .find((node) => node.props.accessibilityLabel === 'Contact details for Bob')!;
    await act(async () => header.props.onPress());
    expect(JSON.stringify(tree!.toJSON())).toContain('bob@example.com');
    const labels = tree!.root.findAllByType('AppButton' as any).map((node) => node.props.children);
    expect(labels).toEqual(
      expect.arrayContaining([
        'Copy npub',
        'Share contact',
        'Check and sync',
        'Delete contact',
        'Block contact',
      ]),
    );
    expect(labels.join(' ')).not.toMatch(/QR/i);
  });

  it('keeps detailed timestamps in the message sheet and uses a warning card for an invitation', async () => {
    await act(async () => {
      tree = create(<ConversationScreen />);
    });
    const payment = tree!.root
      .findAllByType('AppPressable' as any)
      .find((node) => node.props.accessibilityLabel?.includes('Show payment details'))!;
    expect(payment.props.bg).toBe('$buttonWarningSecondary');
    expect(JSON.stringify(tree!.toJSON())).not.toContain('Payment details');
    await act(async () => payment.props.onPress());
    expect(JSON.stringify(tree!.toJSON())).toContain('Payment details');
    expect(JSON.stringify(tree!.toJSON())).toContain('Time');
    expect(JSON.stringify(tree!.toJSON())).not.toContain('cashuBsynthetic-secret');
  });

  it('shows a queued message and frees the composer while publication is still pending', async () => {
    usePeopleStore.getState().setContactStatus(bob, 'accepted');
    let publish!: () => void;
    jest.mocked(nostrService.sendChat).mockImplementation(async (conversation, text, onQueued) => {
      onQueued?.({
        id: 'queued',
        conversation,
        text,
        direction: 'outgoing',
        publication: 'sending',
        createdAt: 1000,
        receivedAt: 1000,
        transport: 'nip17',
        read: true,
      });
      await new Promise<void>((resolve) => {
        publish = resolve;
      });
    });
    await act(async () => {
      tree = create(<ConversationScreen />);
    });
    await act(async () =>
      tree!.root.findByType('Input' as any).props.onChangeText('Instant bubble'),
    );
    const send = () =>
      tree!.root
        .findAllByType('AppIconButton' as any)
        .find((node) => node.props.accessibilityLabel === 'Send message')!;
    await act(async () => send().props.onPress());
    expect(tree!.root.findByType('Input' as any).props.value).toBe('');
    expect(JSON.stringify(tree!.toJSON())).toContain('Instant bubble');
    await act(async () => tree!.root.findByType('Input' as any).props.onChangeText('Next message'));
    expect(send().props.disabled).toBe(false);
    await act(async () => publish());
  });

  it('caps the composer at four scaled lines and then enables internal scrolling', async () => {
    usePeopleStore.getState().setContactStatus(bob, 'accepted');
    await act(async () => {
      tree = create(<ConversationScreen />);
    });
    await act(async () =>
      tree!.root
        .findByType('Input' as any)
        .props.onContentSizeChange({ nativeEvent: { contentSize: { height: 400 } } }),
    );
    const input = tree!.root.findByType('Input' as any);
    expect(input.props.height).toBe(input.props.maxHeight);
    expect(input.props.scrollEnabled).toBe(true);
    await act(async () => input.props.onChangeText(''));
    expect(tree!.root.findByType('Input' as any).props.height).toBe(44);
  });

  it('formats payment cards in the selected primary and secondary currencies', async () => {
    useSettingsStore.setState({ primaryCurrency: 'FIAT' });
    useNostrInboxStore.setState((state) => ({
      items: state.items.map((item) => ({ ...item, amount: 100000 })),
    }));
    await act(async () => {
      tree = create(<ConversationScreen />);
    });
    expect(JSON.stringify(tree!.toJSON())).toContain('$60.00');
    expect(JSON.stringify(tree!.toJSON())).toContain('100,000 SATS');
  });

  it('uses branded secondary for sent payments and white-on-dark for sent text', async () => {
    usePeopleStore.getState().setContactStatus(bob, 'accepted');
    mockSavedMessages = [
      {
        id: 'outgoing-text',
        conversation: bob,
        direction: 'outgoing',
        createdAt: 1000,
        receivedAt: 1000,
        text: 'Text bubble',
        read: true,
        publication: 'sent',
        transport: 'nip17',
      },
      {
        id: 'outgoing-payment',
        conversation: bob,
        direction: 'outgoing',
        createdAt: 2000,
        receivedAt: 2000,
        text: '',
        read: true,
        publication: 'sent',
        transport: 'nip17',
        paymentId: 'payment',
        paymentAmount: 50,
        paymentType: 'token',
      },
    ];
    await act(async () => {
      tree = create(<ConversationScreen />);
    });
    const cards = tree!.root.findAllByType('AppPressable' as any);
    const text = cards.find((node) => node.props.accessibilityLabel?.startsWith('Text bubble.'))!;
    expect(text.props.bg).toBe('$surface10');
    expect(cards.some((node) => node.props.bg === '$buttonBrandedSecondary')).toBe(true);
    expect(
      cards.some(
        (node) =>
          node.props.accessibilityLabel?.includes('Show payment details') &&
          node.props.bg === '$buttonDefaultSecondary',
      ),
    ).toBe(true);
  });

  it('deleting a contact preserves activity and requires acceptance again, even in Everyone mode', async () => {
    usePeopleStore.getState().setContactStatus(bob, 'accepted');
    useNostrReceiveSettingsStore.getState().setPolicy('everyone');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await act(async () => {
      tree = create(<ConversationScreen />);
    });
    const header = tree!.root
      .findAllByType('AppPressable' as any)
      .find((node) => node.props.accessibilityLabel === 'Contact details for Bob')!;
    await act(async () => header.props.onPress());
    const remove = tree!.root
      .findAllByType('AppButton' as any)
      .find((node) => node.props.children === 'Delete contact')!;
    await act(async () => remove.props.onPress());
    const confirm = alert.mock.calls[0][2]!.find((button) => button.text === 'Delete contact')!;
    await act(async () => confirm.onPress!());
    applyIncomingContactPolicy(bob);
    expect(usePeopleStore.getState().people[bob]).toMatchObject({
      contactStatus: 'unaccepted',
      requiresAcceptance: true,
    });
    expect(useNostrInboxStore.getState().items).toHaveLength(2);
    expect(tree!.root.findAllByType('Input' as any)).toHaveLength(0);
  });
});
