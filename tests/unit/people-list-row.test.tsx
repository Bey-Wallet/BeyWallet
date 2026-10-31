import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { nip19 } from 'nostr-tools';
import { PeopleListRow } from '~/features/people/components/PeopleListRow';
import type { PeopleListItem } from '~/features/people/peopleListModel';

jest.mock('tamagui', () => ({ Text: 'Text', XStack: 'XStack', YStack: 'YStack' }));
jest.mock('~/shared/ui/AppPressable', () => ({ AppPressable: 'AppPressable' }));
jest.mock('~/features/people/components/ConversationAvatar', () => ({
  ConversationAvatar: 'Avatar',
}));
jest.mock('~/shared/icons/Nip05VerifiedBadge', () => 'VerifiedBadge');
jest.mock('@tamagui/lucide-icons', () => ({
  Banknote: 'BanknoteIcon',
  Zap: 'BoltIcon',
  HandCoins: 'RequestIcon',
}));

const npub = nip19.npubEncode('01'.repeat(32));
const now = new Date(2026, 8, 10, 12);
const base: PeopleListItem = {
  id: 'alice',
  npub,
  name: 'Alice',
  kind: 'conversation',
  verified: false,
  preview: 'See you tonight',
  updatedAt: now.getTime(),
  unread: true,
  unreadCount: 3,
  profile: { npub, pubkeyHex: '01'.repeat(32), source: 'identifier' },
};

describe('minimal People rows', () => {
  let tree: ReactTestRenderer;
  afterEach(async () => {
    if (tree) await act(async () => tree.unmount());
  });

  it('uses a circular avatar, two text lines, compact time, unread styling and one conversation action', async () => {
    const press = jest.fn();
    await act(async () => {
      tree = create(<PeopleListRow item={{ ...base, verified: true }} now={now} onPress={press} />);
    });
    expect(tree!.root.findByType('Avatar' as any).props.size).toBe(48);
    expect(tree!.root.findAllByType('VerifiedBadge' as any)).toHaveLength(1);
    const row = tree!.root.findByType('AppPressable' as any);
    expect(row.props.minHeight).toBe(76);
    expect(row.props.accessibilityLabel).toContain('3 unread items');
    expect(
      tree!.root.findAllByType('Text' as any).some((node) => node.props.children === '3'),
    ).toBe(true);
    expect(
      tree!.root.findAllByType('YStack' as any).some((node) => node.props.bg === '$red10'),
    ).toBe(true);
    const name = tree!.root
      .findAllByType('Text' as any)
      .find((node) => node.props.children === 'Alice')!;
    expect(name.props.fontWeight).toBe('700');
    expect(name.props.numberOfLines).toBe(1);
    await act(async () => row.props.onPress());
    expect(press).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['ecash', 'BanknoteIcon'],
    ['lightning', 'BoltIcon'],
    ['request', 'RequestIcon'],
  ] as const)('uses the %s icon for a payment preview', async (icon, component) => {
    await act(async () => {
      tree = create(<PeopleListRow item={{ ...base, icon }} now={now} onPress={() => {}} />);
    });
    expect(tree!.root.findAllByType(component as any)).toHaveLength(1);
  });

  it('omits time and unread markers from search rows', async () => {
    await act(async () => {
      tree = create(
        <PeopleListRow
          item={{ ...base, kind: 'search', updatedAt: undefined, unread: false, unreadCount: 0 }}
          now={now}
          onPress={() => {}}
        />,
      );
    });
    expect(tree!.root.findByType('AppPressable' as any).props.accessibilityLabel).not.toContain(
      'unread',
    );
    expect(tree!.root.findAllByType('Text' as any)).toHaveLength(2);
  });

  it('caps the visual count while keeping the full count accessible and clears it when read', async () => {
    await act(async () => {
      tree = create(
        <PeopleListRow item={{ ...base, unreadCount: 120 }} now={now} onPress={() => {}} />,
      );
    });
    expect(JSON.stringify(tree!.toJSON())).toContain('99+');
    expect(tree!.root.findByType('AppPressable' as any).props.accessibilityLabel).toContain(
      '120 unread items',
    );
    await act(async () =>
      tree.update(
        <PeopleListRow
          item={{ ...base, unread: false, unreadCount: 0 }}
          now={now}
          onPress={() => {}}
        />,
      ),
    );
    expect(JSON.stringify(tree!.toJSON())).not.toContain('99+');
    expect(
      tree!.root.findAllByType('YStack' as any).some((node) => node.props.bg === '$red10'),
    ).toBe(false);
  });
});
