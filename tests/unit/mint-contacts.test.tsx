import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MintContacts } from '~/features/mints/components/MintContacts';

jest.mock('tamagui', () => ({ Text: 'Text', YStack: 'YStack' }));
jest.mock('~/shared/ui/ListTable', () => ({ ListTable: 'Table', ListTableRow: 'Row' }));

it.each([undefined, null, [], [null, {}, ['', '  ']], 'invalid'])(
  'shows the empty state when no usable contacts are listed (%j)',
  async (contacts) => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<MintContacts contacts={contacts} />);
    });
    expect(tree.root.findByType('Row' as any).props).toMatchObject({ label: 'No contacts listed' });
    expect(tree.root.findByType('Row' as any).props.isCopyable).toBeUndefined();
    await act(async () => tree.unmount());
  },
);

it('keeps tuple and object contacts copyable in the compact list', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <MintContacts
        contacts={[['email', 'help@example.com'], { method: 'nostr', info: 'npub-example' }]}
      />,
    );
  });
  expect(tree.root.findByType('Table' as any).props.compact).toBe(true);
  expect(tree.root.findAllByType('Row' as any).map((row) => row.props)).toMatchObject([
    { label: 'Email', value: 'help@example.com', isCopyable: true },
    { label: 'Nostr', value: 'npub-example', isCopyable: true },
  ]);
  await act(async () => tree.unmount());
});
