import { LegendList } from '@legendapp/list/react-native';
jest.mock('@legendapp/list/react-native', () => ({ LegendList: require('react-native').FlatList }));
jest.mock('~/shared/ui/RemoteImage', () => ({ RemoteImage: 'RemoteImage' }));
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
import { Alert, DeviceEventEmitter, ScrollView } from 'react-native';
import { applyIncomingContactPolicy } from '~/services/wallet/contactPolicy';
import { useWalletStore } from '~/state/walletStore';
import * as Clipboard from 'expo-clipboard';
import { ListTableRow } from '~/shared/ui/ListTable';
import { loadPeopleHistory } from '~/features/people/hooks/usePeopleList';
import { historyService } from '~/services/wallet/historyService';

const alice = nip19.npubEncode('01'.repeat(32));
const bob = nip19.npubEncode('02'.repeat(32));
const eve = nip19.npubEncode('03'.repeat(32));
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;
const mockParams = { npub: bob };
let mockSavedMessages: ChatMessage[] = [];
let mockHistory: any[] = [];
let mockRemoteResults: any[] = [];
let mockSearchError: string | null = null;
let mockSearching = false;
const mockRetrySearch = jest.fn();
const mockRefetch = jest.fn(async () => ({ data: [] }));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
    canGoBack: () => mockCanGoBack,
  }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
  Stack: { Screen: () => null },
}));
jest.mock('tamagui', () =>
  Object.fromEntries(
    ['Input', 'Image', 'ScrollView', 'Text', 'View', 'XStack', 'YStack', 'Spinner', 'Theme'].map(
      (name) => [name, name],
    ),
  ),
);
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'AppButton' }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: 'Spinner' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'AppPressable' }));
jest.mock('@tamagui/toast', () => ({ useToastController: () => ({ show: jest.fn() }) }));
jest.mock('~/shared/ui/ListTable', () => ({
  ...jest.requireActual('~/shared/ui/ListTable'),
  ListTable: ({ children }: any) => require('react').createElement('ListTable', {}, children),
}));
jest.mock('~/shared/ui/AppIconButton', () => ({
  AppIconButton: ({ icon: _icon, ...props }: any) =>
    require('react').createElement('AppIconButton', props),
}));
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
      'Info',
      'UserCheck',
      'UserPlus',
      'Banknote',
      'HandCoins',
      'ChevronRight',
    ].map((name) => [name, (props: any) => require('react').createElement(`Icon${name}`, props)]),
  ),
);
jest.mock('~/shared/ui/Blockies', () => 'Blockies');
jest.mock('~/features/people/components/PeopleListRow', () => ({ PeopleListRow: 'PeopleRow' }));
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
jest.mock('~/state/walletStore', () => ({
  useWalletStore: require('zustand').create(() => ({ setScannerResult: jest.fn() })),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0 }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: any) => ({
    data: queryKey[0] === 'bitcoinPrice' ? { price: 60000 } : mockHistory,
    refetch: mockRefetch,
  }),
}));
jest.mock('~/features/people/hooks/useNostrProfileSearch', () => ({
  useNostrProfileSearch: () => ({
    results: mockRemoteResults,
    isSearching: mockSearching,
    error: mockSearchError,
    retry: mockRetrySearch,
  }),
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
        page: jest.fn(async (_npub, offset = 0) => mockSavedMessages.slice(offset, offset + 50)),
        markRead: jest.fn(async () => undefined),
        recent: jest.fn(async () => mockSavedMessages),
        unread: jest.fn(async () => ({})),
      },
    }),
  },
}));
jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
}));

describe('People conversations and invitations', () => {
  let tree: ReactTestRenderer;
  const activeList = () => {
    const lists = tree.root.findAllByType(LegendList);
    if (lists.length === 1) return lists[0];
    const requestsSelected = tree.root
      .findAllByType('AppPressable' as any)
      .some(
        (node) =>
          node.props.accessibilityLabel?.startsWith('Requests,') &&
          node.props.accessibilityState?.selected,
      );
    return lists[requestsSelected ? 1 : 0];
  };
  beforeEach(() => {
    useSettingsStore.setState({ primaryCurrency: 'SATS', secondaryCurrency: 'USD' });
    mockSavedMessages = [];
    mockHistory = [];
    mockRemoteResults = [];
    mockSearchError = null;
    mockSearching = false;
    mockRetrySearch.mockClear();
    mockRefetch.mockClear();
    mockPush.mockClear();
    mockBack.mockClear();
    mockReplace.mockClear();
    mockCanGoBack = true;
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
    expect(text).toContain('Recent');
    expect(text).toContain('Requests');
    expect(text).not.toContain('Favorites');
    expect(
      activeList()
        .findAllByType('PeopleRow' as any)
        .map((row) => row.props.item.npub),
    ).toEqual([alice]);
    const requests = tree!.root
      .findAllByType('AppPressable' as any)
      .find((node) => node.props.accessibilityLabel === 'Requests, 1 unread conversations')!;
    await act(async () => requests.props.onPress());
    expect(
      activeList()
        .findAllByType('PeopleRow' as any)
        .map((row) => row.props.item.npub),
    ).toEqual([bob]);
  });

  it('removes paste, swipes between tabs, and updates unread badges when a conversation is read', async () => {
    useMessageStore.setState({ unread: { [alice]: 4, [eve]: 2 } });
    await act(async () => {
      tree = create(<PeopleScreen />);
    });
    const tab = (name: string) =>
      tree.root
        .findAllByType('AppPressable' as any)
        .find(
          (node) =>
            node.props.accessibilityRole === 'tab' &&
            node.props.accessibilityLabel.startsWith(name),
        )!;
    expect(tab('Recent').props.accessibilityLabel).toBe('Recent, 1 unread conversations');
    expect(tab('Requests').props.accessibilityLabel).toBe('Requests, 1 unread conversations');
    expect(
      tree.root
        .findAllByType('AppIconButton' as any)
        .some((node) => node.props.accessibilityLabel === 'Paste identifier'),
    ).toBe(false);
    const pager = tree.root.findAllByType(ScrollView).find((node) => node.props.horizontal)!;
    const swipe = async (x: number) =>
      act(async () => {
        pager.props.onMomentumScrollEnd!({ nativeEvent: { contentOffset: { x } } } as any);
      });
    await swipe(10000);
    expect(tab('Requests').props.accessibilityState.selected).toBe(true);
    expect(activeList().findAllByType('PeopleRow' as any)[0].props.item.npub).toBe(bob);
    await swipe(0);
    expect(tab('Recent').props.accessibilityState.selected).toBe(true);
    await act(async () => useMessageStore.setState({ unread: {} }));
    expect(tab('Recent').props.accessibilityLabel).toBe('Recent, 0 unread conversations');
    await act(async () => useNostrInboxStore.getState().markAllSeen());
    expect(tab('Requests').props.accessibilityLabel).toBe('Requests, 0 unread conversations');
  });

  it('shows saved matches immediately while online search is pending and keeps them above online results', async () => {
    mockSearching = true;
    await act(async () => {
      tree = create(<PeopleScreen />);
    });
    await act(async () => tree.root.findByType('Input' as any).props.onChangeText('Ali'));
    const rows = () => tree.root.findAllByType('PeopleRow' as any);
    expect(rows().map((row) => row.props.item.npub)).toEqual([alice]);
    expect(rows()[0].props.item.name).toBe('Alice');
    const online = nip19.npubEncode('04'.repeat(32));
    mockRemoteResults = [
      { npub: alice, pubkeyHex: '01'.repeat(32), displayName: 'Alice', source: 'identifier' },
      { npub: online, pubkeyHex: '04'.repeat(32), displayName: 'Alina', source: 'identifier' },
    ];
    mockSearching = false;
    await act(async () => tree.update(<PeopleScreen />));
    expect(rows().map((row) => row.props.item.npub)).toEqual([alice, online]);
  });

  it('keeps local search results during remote failure, retries, and restores tab/scroll after clearing search', async () => {
    mockSearchError = 'Unavailable';
    await act(async () => {
      tree = create(<PeopleScreen />);
    });
    const requests = () =>
      tree!.root
        .findAllByType('AppPressable' as any)
        .find((node) => node.props.accessibilityLabel === 'Requests, 1 unread conversations')!;
    await act(async () => requests().props.onPress());
    const list = activeList;
    await act(async () => list().props.onContentSizeChange!(320, 2000));
    await act(async () =>
      list().props.onScroll!({ nativeEvent: { contentOffset: { y: 320 } } } as any),
    );
    await act(async () => tree!.root.findByType('Input' as any).props.onChangeText('Alice'));
    expect(tree!.root.findAllByType('PeopleRow' as any).map((row) => row.props.item.npub)).toEqual([
      alice,
    ]);
    expect(
      tree!.root
        .findAllByType('Text' as any)
        .some(
          (node) =>
            typeof node.props.children === 'string' &&
            node.props.children.includes('Your saved people are still available'),
        ),
    ).toBe(true);
    await act(async () =>
      tree!.root
        .findAllByType('AppButton' as any)
        .find((node) => node.props.children === 'Retry search')!
        .props.onPress(),
    );
    expect(mockRetrySearch).toHaveBeenCalledTimes(1);
    await act(async () =>
      tree!.root
        .findAllByType('AppIconButton' as any)
        .find((node) => node.props.accessibilityLabel === 'Clear search')!
        .props.onPress(),
    );
    expect(requests().props.accessibilityState.selected).toBe(true);
    expect(list().props.initialScrollOffset).toBe(320);
  });

  it('opens conversations from people rows and claim review from payment issue rows', async () => {
    useNostrInboxStore.getState().addIncoming({
      id: 'issue',
      tokenString: 'cashuBsecret',
      amount: 4,
      mintUrl: 'https://mint.example',
      senderPubkey: '01'.repeat(32),
    });
    useNostrInboxStore.getState().markApprovalRequired('issue');
    const emit = jest.spyOn(DeviceEventEmitter, 'emit');
    await act(async () => {
      tree = create(<PeopleScreen />);
    });
    await act(async () => tree!.root.findAllByType('PeopleRow' as any)[0].props.onPress());
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/(modals)/conversation',
        params: expect.objectContaining({ npub: alice }),
      }),
    );
    await act(async () =>
      tree!.root
        .findAllByType('AppPressable' as any)
        .find(
          (node) =>
            node.props.accessibilityRole === 'tab' &&
            node.props.accessibilityLabel.startsWith('Requests'),
        )!
        .props.onPress(),
    );
    const issue = tree!.root
      .findAllByType('PeopleRow' as any)
      .find((node) => node.props.item.kind === 'issue')!;
    await act(async () => issue.props.onPress());
    expect(emit).toHaveBeenCalledWith('nostr:openClaim', expect.objectContaining({ id: 'issue' }));
    expect(useNostrInboxStore.getState().items.find((item) => item.id === 'issue')?.status).toBe(
      'approval_required',
    );
  });

  it('paginates the active list in batches of 50 and refreshes its data sources', async () => {
    const people = Object.fromEntries(
      Array.from({ length: 120 }, (_, index) => {
        const npub = nip19.npubEncode((index + 10).toString(16).padStart(64, '0'));
        return [npub, { npub, displayName: `Person ${index}`, contactStatus: 'accepted' as const }];
      }),
    );
    usePeopleStore.setState({ people });
    await act(async () => {
      tree = create(<PeopleScreen />);
    });
    const list = activeList;
    expect(list().props.data).toHaveLength(50);
    await act(async () => list().props.onEndReached!({ distanceFromEnd: 0 }));
    expect(list().props.data).toHaveLength(100);
    await act(async () => {
      list().props.onRefresh!();
    });
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('loads tagged history beyond the first wallet page and deduplicates overlapping pages', async () => {
    const tagged = {
      id: 'tagged',
      type: 'receive',
      amount: 5,
      createdAt: Date.now(),
      metadata: { nostrPubkey: alice },
    };
    const older = { ...tagged, id: 'older', createdAt: tagged.createdAt - 5000 };
    jest
      .mocked(historyService.getHistory)
      .mockResolvedValueOnce([
        tagged,
        ...Array.from({ length: 499 }, (_, index) => ({
          id: `unrelated-${index}`,
          type: 'send',
          metadata: {},
        })),
      ] as any)
      .mockResolvedValueOnce([tagged, older] as any);
    const entries = await loadPeopleHistory();
    expect(entries.map((entry) => entry.id)).toEqual(['tagged', 'older']);
    expect(historyService.getHistory).toHaveBeenCalledWith(500, 500);
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
    expect(tree!.root.findAllByType('VerifiedBadge' as any)).toHaveLength(1);
    const header = tree!.root
      .findAllByType('AppIconButton' as any)
      .find((node) => node.props.accessibilityLabel === 'Contact details for Bob')!;
    const name = tree!.root
      .findAllByType('AppPressable' as any)
      .find((node) => node.props.accessibilityLabel === 'Open profile for Bob')!;
    expect(name.props.onPress).toBe(header.props.onPress);
    await act(async () => name.props.onPress());
    expect(JSON.stringify(tree!.toJSON())).toContain('bob@example.com');
    expect(tree!.root.findAllByType('ListTable' as any)).toHaveLength(1);
    const labels = tree!.root.findAllByType(ListTableRow).map((node) => node.props.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        bob,
        'Share contact',
        'Check and sync',
        'Delete contact',
        'Block contact',
      ]),
    );
    expect(labels.join(' ')).not.toMatch(/QR/i);
    const copy = jest.spyOn(Clipboard, 'setStringAsync').mockResolvedValue(true);
    await act(async () =>
      tree!.root
        .findAllByType('AppIconButton' as any)
        .find((node) => node.props.accessibilityLabel === 'Copy')!
        .props.onPress(),
    );
    expect(copy).toHaveBeenCalledWith(bob);
    expect(
      tree!.root
        .findAllByType('AppButton' as any)
        .some((node) => node.props.children === 'Share contact'),
    ).toBe(false);
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
    expect(JSON.stringify(tree!.toJSON())).toContain('100,000 sat');
  });

  it('hides conversion amounts for None and restores the saved fiat preference', async () => {
    useSettingsStore.setState({ primaryCurrency: 'FIAT', secondaryCurrency: 'NONE' });
    useNostrInboxStore.setState((state) => ({
      items: state.items.map((item) => ({ ...item, amount: 100000 })),
    }));
    await act(async () => {
      tree = create(<ConversationScreen />);
    });
    expect(JSON.stringify(tree!.toJSON())).toContain('100,000 sat');
    expect(JSON.stringify(tree!.toJSON())).not.toMatch(/\$60\.00|rate unavailable/);
    await act(async () => useSettingsStore.setState({ secondaryCurrency: 'USD' }));
    expect(JSON.stringify(tree!.toJSON())).toContain('$60.00');
    expect(useSettingsStore.getState().primaryCurrency).toBe('FIAT');
  });

  it('uses neutral primary for sent payments and text with equal corners', async () => {
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
    expect(text.props.bg).toBe('$buttonDefaultPrimary');
    expect(text.props.rounded).toBe(16);
    expect(text.props.borderBottomRightRadius).toBeUndefined();
    expect(text.props.borderBottomLeftRadius).toBeUndefined();
    expect(
      cards.find((node) => node.props.accessibilityLabel?.startsWith('Ecash,'))?.props.bg,
    ).toBe('$buttonDefaultPrimary');
    expect(
      cards.some(
        (node) =>
          node.props.accessibilityLabel?.includes('Show payment details') &&
          node.props.bg === '$buttonDefaultSecondary',
      ),
    ).toBe(true);
  });

  it('shows text immediately before encryption finishes, reconciles once, and restores an unsaved draft on failure', async () => {
    usePeopleStore.getState().setContactStatus(bob, 'accepted');
    let queue!: () => void;
    let reject!: (error: Error) => void;
    jest.mocked(nostrService.sendChat).mockImplementation(
      (conversation, text, onQueued) =>
        new Promise<void>((resolve, fail) => {
          reject = fail;
          queue = () => {
            onQueued?.({
              id: 'persisted',
              conversation,
              text,
              direction: 'outgoing',
              publication: 'sending',
              createdAt: Date.now(),
              receivedAt: Date.now(),
              read: true,
              transport: 'nip17',
            });
            resolve();
          };
        }),
    );
    await act(async () => {
      tree = create(<ConversationScreen />);
    });
    const input = () => tree!.root.findByType('Input' as any);
    const send = () =>
      tree!.root
        .findAllByType('AppIconButton' as any)
        .find((node) => node.props.accessibilityLabel === 'Send message')!;
    const bubbles = () =>
      tree!.root
        .findAllByType('AppPressable' as any)
        .filter((node) => node.props.accessibilityLabel?.startsWith('Before encryption.'));
    await act(async () => input().props.onChangeText('Before encryption'));
    await act(async () => send().props.onPress());
    expect(bubbles()).toHaveLength(1);
    expect(bubbles()[0].props.accessibilityLabel).toContain('Sending');
    expect(input().props.value).toBe('');
    await act(async () => queue());
    expect(bubbles()).toHaveLength(1);
    await act(async () => input().props.onChangeText('Unsaved'));
    await act(async () => send().props.onPress());
    await act(async () => input().props.onChangeText('New draft'));
    await act(async () => reject(new Error('Storage unavailable')));
    expect(input().props.value).toBe('Unsaved\nNew draft');
    expect(
      tree!.root
        .findAllByType('AppPressable' as any)
        .some((node) => node.props.accessibilityLabel?.startsWith('Unsaved.')),
    ).toBe(false);
  });

  it('offers Add contact instead of Accept/Block when initiating a new conversation', async () => {
    useNostrInboxStore.setState({ items: [] });
    usePeopleStore.getState().savePerson({ npub: bob, hasIncomingActivity: false });
    await act(async () => {
      tree = create(<ConversationScreen />);
    });
    const buttons = () => tree!.root.findAllByType('AppButton' as any);
    expect(buttons().some((node) => node.props.children === 'Accept')).toBe(false);
    expect(buttons().some((node) => node.props.children === 'Reject and block')).toBe(false);
    expect(
      tree!.root
        .findAllByType('AppIconButton' as any)
        .some((node) => node.props.accessibilityLabel === 'Conversation state preview'),
    ).toBe(false);
    const close = tree!.root
      .findAllByType('AppIconButton' as any)
      .find((node) => node.props.accessibilityLabel === 'Back')!;
    expect(close.props).toMatchObject({
      size: 'xsmall',
      shape: 'circular',
      emphasis: 'ghost',
      iconSize: 22,
    });
    close.props.onPress();
    expect(mockBack).toHaveBeenCalledTimes(1);
    mockCanGoBack = false;
    close.props.onPress();
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/people');
    await act(async () =>
      buttons()
        .find((node) => node.props.children === 'Add contact')!
        .props.onPress(),
    );
    expect(usePeopleStore.getState().people[bob].contactStatus).toBe('accepted');
    expect(tree!.root.findAllByType('Input' as any)).toHaveLength(1);
    const pay = buttons().find((node) => node.props.children === 'Pay')!;
    expect(pay.props.disabled).toBe(false);
    expect(pay.props.flex).toBeUndefined();
  });

  it('loads the latest 50 mixed activities first and loads older items on upward scroll', async () => {
    usePeopleStore.getState().setContactStatus(bob, 'accepted');
    const scrollTo = jest.fn();
    const frames: FrameRequestCallback[] = [];
    jest.mocked(requestAnimationFrame).mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const noon = new Date().setHours(12, 0, 0, 0);
    useNostrInboxStore.setState((state) => ({
      items: state.items.map((item) => ({ ...item, receivedAt: noon - 80000 })),
    }));
    mockHistory = Array.from({ length: 60 }, (_, index) => ({
      id: `history-${index}`,
      type: 'send',
      amount: index,
      createdAt: noon - (60 - index) * 1000,
      metadata: { nostrPubkey: bob },
    }));
    await act(async () => {
      tree = create(<ConversationScreen />, {
        createNodeMock: (element) =>
          element.type === 'ScrollView' ? { scrollTo, scrollToEnd: jest.fn() } : null,
      });
    });
    const cards = () =>
      tree!.root
        .findAllByType('AppPressable' as any)
        .filter((node) => node.props.accessibilityLabel?.includes('Show payment details'));
    expect(cards()).toHaveLength(50);
    expect(cards()[0].props.accessibilityLabel).toContain('10 sat');
    expect(cards()[49].props.accessibilityLabel).toContain('59 sat');
    expect(cards()[0].props.width).toBeUndefined();
    expect(cards()[0].props.minWidth).toBeUndefined();
    const scroll = tree!.root.findByType('ScrollView' as any);
    await act(async () =>
      scroll.props.onScroll({
        nativeEvent: {
          contentOffset: { y: 0 },
          contentSize: { height: 3000 },
          layoutMeasurement: { height: 600 },
        },
      }),
    );
    expect(cards()).toHaveLength(50);
    await act(async () => scroll.props.onScrollBeginDrag());
    await act(async () =>
      scroll.props.onScroll({
        nativeEvent: {
          contentOffset: { y: 20 },
          contentSize: { height: 3000 },
          layoutMeasurement: { height: 600 },
        },
      }),
    );
    expect(cards()).toHaveLength(62);
    await act(async () =>
      tree!.root.findByType('ScrollView' as any).props.onContentSizeChange(320, 3500),
    );
    await act(async () => {
      for (const frame of frames) frame(0);
    });
    expect(scrollTo).toHaveBeenCalledWith({ y: 520, animated: false });
    const labels = tree!.root
      .findAllByType('Text' as any)
      .filter((node) => node.props.children === 'Today');
    expect(labels).toHaveLength(1);
  });

  it('recognizes a Lightning invoice as an auto-width payment card and opens review only on explicit action', async () => {
    usePeopleStore.getState().setContactStatus(bob, 'accepted');
    mockSavedMessages = [
      {
        id: 'invoice',
        conversation: bob,
        direction: 'incoming',
        text: 'lightning:lnbc210n1ptestinvoice',
        createdAt: Date.now(),
        receivedAt: Date.now(),
        read: true,
        publication: 'sent',
        transport: 'nip17',
      },
    ];
    await act(async () => {
      tree = create(<ConversationScreen />);
    });
    const card = tree!.root
      .findAllByType('AppPressable' as any)
      .find((node) => node.props.accessibilityLabel?.startsWith('Lightning'))!;
    expect(card.props.width).toBeUndefined();
    expect(JSON.stringify(tree!.toJSON())).not.toContain('lnbc210n1ptestinvoice');
    expect(card.props.bg).toBe('$buttonWarningSecondary');
    await act(async () => card.props.onPress());
    await act(async () =>
      tree!.root
        .findAllByType(ListTableRow)
        .find((node) => node.props.label === 'Review payment')!
        .props.onPress(),
    );
    expect(useWalletStore.getState().setScannerResult).toHaveBeenCalledWith(
      'lnbc210n1ptestinvoice',
    );
    expect(mockPush).toHaveBeenCalledWith('/(modals)/melt');
  });

  it('deleting a contact preserves activity and requires acceptance again, even in Everyone mode', async () => {
    usePeopleStore.getState().setContactStatus(bob, 'accepted');
    useNostrReceiveSettingsStore.getState().setPolicy('everyone');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await act(async () => {
      tree = create(<ConversationScreen />);
    });
    const header = tree!.root
      .findAllByType('AppIconButton' as any)
      .find((node) => node.props.accessibilityLabel === 'Contact details for Bob')!;
    await act(async () => header.props.onPress());
    const remove = tree!.root
      .findAllByType(ListTableRow)
      .find((node) => node.props.label === 'Delete contact')!;
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

  it('uses distinct payment icons and an adjacent secondary Pay action for incoming requests', async () => {
    usePeopleStore.getState().setContactStatus(bob, 'accepted');
    useNostrInboxStore.setState((state) => ({
      items: state.items.map((item) =>
        item.id === 'offer-1' ? { ...item, type: 'request', tokenString: 'creq-synthetic' } : item,
      ),
    }));
    await act(async () => {
      tree = create(<ConversationScreen />);
    });
    expect(tree!.root.findAllByType('IconHandCoins' as any)).toHaveLength(1);
    expect(tree!.root.findAllByType('IconBanknote' as any)).toHaveLength(1);
    const pay = tree!.root
      .findAllByType('AppButton' as any)
      .find((node) => node.props.accessibilityLabel === 'Pay Ecash request')!;
    expect(pay.props).toMatchObject({ emphasis: 'secondary', disabled: false });
    expect(mockPush).not.toHaveBeenCalled();
    await act(async () => pay.props.onPress());
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(modals)/send',
      params: { paymentRequest: 'creq-synthetic', inboxItemId: 'offer-1' },
    });
    expect(useNostrInboxStore.getState().items[0].status).not.toBe('claimed');
  });

  it('does not enable adjacent Pay before acceptance or show it on completed requests', async () => {
    useNostrInboxStore.setState((state) => ({
      items: state.items.map((item) => ({ ...item, type: 'request' })),
    }));
    await act(async () => {
      tree = create(<ConversationScreen />);
    });
    const pay = tree!.root
      .findAllByType('AppButton' as any)
      .find((node) => node.props.accessibilityLabel === 'Pay Ecash request')!;
    expect(pay.props.disabled).toBe(true);
    await act(async () => pay.props.onPress());
    expect(mockPush).not.toHaveBeenCalled();
    await act(async () => {
      useNostrInboxStore.setState((state) => ({
        items: state.items.map((item) => ({ ...item, status: 'claimed' })),
      }));
    });
    expect(
      tree!.root
        .findAllByType('AppButton' as any)
        .some((node) => node.props.accessibilityLabel === 'Pay Ecash request'),
    ).toBe(false);
  });
});
