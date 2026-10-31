import { conversationItemLayout, groupsWith } from '~/features/people/conversationGrouping';
import type { ConversationActivity } from '~/features/people/conversationActivity';

const noon = new Date(2026, 10, 1, 12).getTime();
function message(overrides: Partial<ConversationActivity> = {}): ConversationActivity {
  return {
    id: 'message',
    time: noon,
    direction: 'incoming',
    kind: 'text',
    text: 'Hi',
    status: 'Received',
    requiresAction: false,
    ...overrides,
  } as ConversationActivity;
}

it('groups only nearby text messages from the same sender on the same day', () => {
  const first = message();
  expect(groupsWith(first, message({ time: noon + 300000 }))).toBe(true);
  expect(groupsWith(first, message({ time: noon + 300001 }))).toBe(false);
  expect(groupsWith(first, message({ direction: 'outgoing' }))).toBe(false);
  expect(groupsWith(first, message({ kind: 'payment' }))).toBe(false);
  expect(groupsWith(message({ kind: 'payment' }), first)).toBe(false);
  expect(
    groupsWith(
      message({ time: new Date(2026, 10, 1, 23, 59).getTime() }),
      message({ time: new Date(2026, 10, 2, 0, 1).getTime() }),
    ),
  ).toBe(false);
});

it('places time only at the end of a text group and separates payments', () => {
  const items = [
    message(),
    message({ time: noon + 1000 }),
    message({ kind: 'payment', time: noon + 2000 }),
    message({ time: noon + 3000 }),
  ];
  expect(conversationItemLayout(items, 0)).toEqual({ showDate: true, spacing: 0, showTime: false });
  expect(conversationItemLayout(items, 1)).toEqual({ showDate: false, spacing: 4, showTime: true });
  expect(conversationItemLayout(items, 2)).toEqual({
    showDate: false,
    spacing: 16,
    showTime: false,
  });
  expect(conversationItemLayout(items, 3)).toEqual({
    showDate: false,
    spacing: 16,
    showTime: true,
  });
});
