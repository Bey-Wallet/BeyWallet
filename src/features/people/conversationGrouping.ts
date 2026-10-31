import type { ConversationActivity } from './conversationActivity';
import { conversationDayKey } from './conversationDates';

/** Text messages form a group only within five minutes on the same local day. */
export function groupsWith(previous: ConversationActivity | undefined, item: ConversationActivity) {
  return (
    !!previous &&
    previous.kind === 'text' &&
    item.kind === 'text' &&
    previous.direction === item.direction &&
    item.time >= previous.time &&
    item.time - previous.time <= 5 * 60 * 1000 &&
    conversationDayKey(previous.time) === conversationDayKey(item.time)
  );
}

export function conversationItemLayout(items: ConversationActivity[], index: number) {
  const item = items[index];
  const previous = items[index - 1];
  const next = items[index + 1];
  const showDate = !previous || conversationDayKey(previous.time) !== conversationDayKey(item.time);
  return {
    showDate,
    spacing: index === 0 || showDate ? 0 : groupsWith(previous, item) ? 4 : 16,
    showTime: item.kind === 'text' && (!next || !groupsWith(item, next)),
  };
}
