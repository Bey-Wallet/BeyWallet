import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { getEncodedTokenV3 } from '@cashu/cashu-ts';
import { getTransactionNotes } from '~/features/history/transactionNotes';
import { TransactionNoteRows } from '~/features/history/components/TransactionNoteRows';

jest.mock('~/shared/ui/ListTable', () => ({ ListTableRow: 'Row' }));
jest.mock('tamagui', () => ({ YStack: 'YStack' }));

const entry = { type: 'send', mintUrl: 'https://mint.example' };
const token = getEncodedTokenV3({
  mint: entry.mintUrl,
  memo: 'Dinner share',
  proofs: [
    {
      id: '00' + 'ab'.repeat(7),
      amount: 8,
      secret: 'synthetic-note-proof',
      C: '02' + '11'.repeat(32),
    },
  ],
});

it('reads a memo from a persisted token with no metadata', () => {
  expect(getTransactionNotes({ ...entry, token })).toEqual([
    { label: 'Memo', value: 'Dinner share' },
  ]);
});
it('keeps distinct messages and memos without duplicating the token note', () => {
  expect(
    getTransactionNotes({
      ...entry,
      token,
      metadata: JSON.stringify({
        note: 'Dinner share',
        memo: 'Thank you',
        message: 'See you soon',
      }),
    }),
  ).toEqual([
    { label: 'Note', value: 'Dinner share' },
    { label: 'Memo', value: 'Thank you' },
    { label: 'Message', value: 'See you soon' },
  ]);
});
it.each(['send', 'receive', 'mint', 'melt'])(
  'retains saved attachments for %s even without a valid token',
  (type) => {
    expect(
      getTransactionNotes({
        ...entry,
        type,
        token: 'invalid',
        metadata: { msg: 'Offline\nmessage', note: 'Lunch' },
      }),
    ).toEqual([
      { label: 'Note', value: 'Lunch' },
      { label: 'Message', value: 'Offline\nmessage' },
    ]);
  },
);
it('ignores blank or non-text attachments and malformed metadata', () => {
  expect(
    getTransactionNotes({ ...entry, metadata: { note: ' ', memo: 100, message: {} } }),
  ).toEqual([]);
  expect(getTransactionNotes({ ...entry, metadata: '{bad json', token })).toEqual([
    { label: 'Memo', value: 'Dinner share' },
  ]);
});
it('does not use a token from a different mint', () => {
  expect(getTransactionNotes({ ...entry, mintUrl: 'https://other.example', token })).toEqual([]);
});
it('renders the full multiline attachment and copies the same text', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <TransactionNoteRows notes={[{ label: 'Note', value: 'Lunch\nwith friends' }]} />,
    );
  });
  const row = tree.root.findByType('Row' as any);
  expect(row.props).toMatchObject({
    label: 'Note',
    value: 'Lunch\nwith friends',
    multiline: true,
    isCopyable: true,
    copyValue: 'Lunch\nwith friends',
  });
  await act(async () => tree.unmount());
});
