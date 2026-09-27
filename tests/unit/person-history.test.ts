import { nip19 } from 'nostr-tools';
import { filterPersonHistory, getPersonPaymentStatus } from '~/features/people/personHistory';

const PUBKEY = '5'.repeat(64);
const NPUB = nip19.npubEncode(PUBKEY);

describe('person payment history', () => {
  it('keeps only Nostr sends and receives for the selected person', () => {
    const entries = filterPersonHistory(
      [
        {
          id: 'received',
          type: 'receive',
          amount: 200,
          createdAt: 20,
          metadata: JSON.stringify({ via: 'nostr', nostrPubkey: PUBKEY }),
        },
        {
          id: 'sent',
          type: 'send',
          amount: 100,
          createdAt: 10,
          metadata: { via: 'nostr', nostrPubkey: NPUB },
        },
        {
          id: 'other-person',
          type: 'send',
          amount: 50,
          createdAt: 30,
          metadata: { via: 'nostr', nostrPubkey: nip19.npubEncode('6'.repeat(64)) },
        },
      ],
      NPUB,
    );

    expect(entries.map((entry) => entry.id)).toEqual(['received', 'sent']);
  });

  it('uses wallet state to label claimed and pending payments', () => {
    expect(
      getPersonPaymentStatus({
        id: 'claimed',
        type: 'send',
        amount: 200,
        state: 'claimed',
        createdAt: 1,
      }),
    ).toBe('Claimed');
    expect(
      getPersonPaymentStatus({
        id: 'pending',
        type: 'send',
        amount: 200,
        state: 'pending',
        createdAt: 1,
      }),
    ).toBe('Awaiting claim');
  });
});
