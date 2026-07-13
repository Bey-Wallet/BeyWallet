import { formatLocalTime, formatFullLocalTime, formatRelativeTime } from '../utils/time';

describe('formatLocalTime', () => {
    it('returns "Unknown time" for 0', () => {
        expect(formatLocalTime(0)).toBe('Unknown time');
    });

    it('returns "Unknown time" for NaN', () => {
        expect(formatLocalTime(NaN)).toBe('Unknown time');
    });

    it('handles seconds timestamp (< 1e11)', () => {
        const result = formatLocalTime(1700000000);
        expect(result).toContain('Nov');
        expect(result).not.toBe('Unknown time');
    });

    it('handles milliseconds timestamp (> 1e11)', () => {
        const result = formatLocalTime(1700000000000);
        expect(result).toContain('Nov');
    });
});

describe('formatFullLocalTime', () => {
    it('returns "Unknown date" for 0', () => {
        expect(formatFullLocalTime(0)).toBe('Unknown date');
    });

    it('returns "Unknown date" for NaN', () => {
        expect(formatFullLocalTime(NaN)).toBe('Unknown date');
    });

    it('includes year in output', () => {
        const result = formatFullLocalTime(1700000000000);
        expect(result).toContain('2023');
    });

    it('includes month name in output', () => {
        const result = formatFullLocalTime(1700000000000);
        expect(result).toContain('November');
    });
});

describe('formatRelativeTime', () => {
    it('returns "recently" for 0', () => {
        expect(formatRelativeTime(0)).toBe('recently');
    });

    it('returns "recently" for NaN', () => {
        expect(formatRelativeTime(NaN)).toBe('recently');
    });

    it('returns "just now" for recent timestamps', () => {
        const now = Math.floor(Date.now() / 1000);
        expect(formatRelativeTime(now)).toBe('just now');
        expect(formatRelativeTime(now - 30)).toBe('just now');
    });

    it('returns minutes for timestamps < 1 hour ago', () => {
        const now = Math.floor(Date.now() / 1000);
        const result = formatRelativeTime(now - 120);
        expect(result).toBe('2m');
    });

    it('returns hours for timestamps < 1 day ago', () => {
        const now = Math.floor(Date.now() / 1000);
        const result = formatRelativeTime(now - 7200);
        expect(result).toBe('2h');
    });

    it('returns days for timestamps < 7 days ago', () => {
        const now = Math.floor(Date.now() / 1000);
        const result = formatRelativeTime(now - 172800);
        expect(result).toBe('2d');
    });

    it('returns date for timestamps > 7 days ago', () => {
        const now = Math.floor(Date.now() / 1000);
        const result = formatRelativeTime(now - 604800 * 2);
        expect(result).not.toContain('d');
        expect(result).not.toContain('h');
        expect(result).not.toContain('m');
    });

    it('handles millisecond timestamps', () => {
        const now = Date.now();
        const result = formatRelativeTime(now - 120000);
        expect(result).toBe('2m');
    });
});
