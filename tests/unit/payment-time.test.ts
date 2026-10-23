import { formatPaymentDateTime } from '~/shared/utils/time';

let mockUses24hourClock: boolean | null = false;
jest.mock('expo-localization', () => ({
  getCalendars: () => [{ uses24hourClock: mockUses24hourClock }],
}));
beforeEach(() => {
  mockUses24hourClock = false;
});
afterEach(() => jest.restoreAllMocks());

it('formats local payment dates exactly with uppercase AM/PM', () => {
  const date = new Date(2026, 9, 24, 20, 33);
  expect(formatPaymentDateTime(date.getTime())).toBe('Oct 24, 2026 8:33 PM');
  expect(formatPaymentDateTime(date.getTime() / 1000)).toBe('Oct 24, 2026 8:33 PM');
});

it.each([
  [0, 5, '12:05 AM'],
  [8, 3, '8:03 AM'],
  [12, 0, '12:00 PM'],
  [23, 59, '11:59 PM'],
])('formats local hour %i and minute %i as %s', (hour, minute, expected) => {
  expect(formatPaymentDateTime(new Date(2026, 9, 24, hour, minute).getTime())).toBe(
    `Oct 24, 2026 ${expected}`,
  );
});

it('keeps the local calendar date across a year boundary', () => {
  expect(formatPaymentDateTime(new Date(2027, 0, 1, 0, 1).getTime())).toBe('Jan 1, 2027 12:01 AM');
});

it.each([
  [0, 0, '00:00'],
  [0, 5, '00:05'],
  [8, 3, '08:03'],
  [12, 0, '12:00'],
  [20, 33, '20:33'],
  [23, 59, '23:59'],
])('respects the 24-hour preference at %i:%i', (hour, minute, expected) => {
  mockUses24hourClock = true;
  const timestamp = new Date(2026, 9, 24, hour, minute).getTime();
  expect(formatPaymentDateTime(timestamp)).toBe(`Oct 24, 2026 ${expected}`);
  expect(formatPaymentDateTime(timestamp / 1000)).toBe(`Oct 24, 2026 ${expected}`);
});

it('reads the current device preference on each formatting call', () => {
  const timestamp = new Date(2026, 9, 24, 20, 33).getTime();
  expect(formatPaymentDateTime(timestamp)).toBe('Oct 24, 2026 8:33 PM');
  mockUses24hourClock = true;
  expect(formatPaymentDateTime(timestamp)).toBe('Oct 24, 2026 20:33');
});

it.each([true, false])(
  'uses the system locale clock when the preference is unavailable (hour12=%s)',
  (hour12) => {
    mockUses24hourClock = null;
    const options = new Intl.DateTimeFormat().resolvedOptions();
    jest
      .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
      .mockReturnValue({ ...options, hour12 });
    expect(formatPaymentDateTime(new Date(2026, 9, 24, 8, 3).getTime())).toBe(
      hour12 ? 'Oct 24, 2026 8:03 AM' : 'Oct 24, 2026 08:03',
    );
  },
);

it.each([NaN, Infinity, -Infinity, 9e20])('handles invalid timestamp %s', (timestamp) => {
  expect(formatPaymentDateTime(timestamp)).toBe('Unknown date');
});
