/**
 * @fileoverview Time and date formatting utilities
 * Adapted to match Sovran's Intl.DateTimeFormat implementation
 */

function normalizeToMs(ts: number): number {
  return ts > 1e11 ? ts : ts * 1000;
}

function normalizeToSeconds(ts: number): number {
  return ts > 1e11 ? Math.floor(ts / 1000) : ts;
}

/**
 * Formats a timestamp into a short date-time string
 * Modeled after Sovran's formatCustomDate but including time for History entries.
 */
export function formatLocalTime(timestamp: number): string {
  if (!timestamp || isNaN(timestamp)) return 'Unknown time';
  const date = new Date(normalizeToMs(timestamp));

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false, // 24-hour time notation per Sovran
  }).format(date);
}

/**
 * Returns a full detailed local time string.
 * Modeled after Sovran's convertTime and formatDate.
 */
export function formatFullLocalTime(timestamp: number): string {
  if (!timestamp || isNaN(timestamp)) return 'Unknown date';
  const date = new Date(normalizeToMs(timestamp));

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false, // 24-hour time notation per Sovran
  }).format(date);
}

/**
 * History list subtitle: "Now", "1 min", or "14 Sept" once the calendar day has passed.
 */
export function formatHistoryWhen(timestamp: number): string {
  if (!timestamp || isNaN(timestamp)) return '';
  const date = new Date(normalizeToMs(timestamp));
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  if (!sameDay) {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
    }).format(date);
  }

  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 60_000) return 'Now';
  if (diffMs < 3_600_000) {
    const mins = Math.max(1, Math.floor(diffMs / 60_000));
    return `${mins} min`;
  }
  const hours = Math.max(1, Math.floor(diffMs / 3_600_000));
  return `${hours} hr`;
}

/**
 * Returns a relative time string (e.g. "1h", "2m", "just now").
 * Matches Sovran's getTimeAgo behavior mentioned in comments.
 */
export function formatRelativeTime(timestamp: number): string {
  if (!timestamp || isNaN(timestamp)) return 'recently';
  const nowSecs = Math.floor(Date.now() / 1000);
  const tsSecs = normalizeToSeconds(timestamp);
  const diff = nowSecs - tsSecs;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;

  // Fall back to short date for older timestamps
  const date = new Date(normalizeToMs(timestamp));
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}
