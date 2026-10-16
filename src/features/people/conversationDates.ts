/** Local calendar dates, including DST boundaries, rather than elapsed 24-hour periods. */
export function conversationDayKey(time: number): string {
  const date = new Date(time);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function conversationDateLabel(time: number, now = new Date()): string {
  if (conversationDayKey(time) === conversationDayKey(now.getTime())) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (conversationDayKey(time) === conversationDayKey(yesterday.getTime())) return 'Yesterday';
  const date = new Date(time);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' as const } : {}),
  });
}
