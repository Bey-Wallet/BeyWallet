import { getPossibleAmounts, findExactSubset, findClosestSubsetOptions } from '../utils/offlineSendUtils';
import type { CoreProof } from 'coco-cashu-core';

// Helper to create a mock proof
function makeProof(amount: number, id = 'keyset1'): CoreProof {
    return {
        id,
        amount,
        secret: `secret_${amount}_${Math.random()}`,
        C: `C_${amount}`,
        mintUrl: 'https://mint.test.com',
        state: 'ready',
    } as CoreProof;
}

describe('getPossibleAmounts', () => {
    it('returns empty array for empty proofs', () => {
        expect(getPossibleAmounts([])).toEqual([]);
    });

    it('returns single amount for one proof', () => {
        const proofs = [makeProof(100)];
        expect(getPossibleAmounts(proofs)).toEqual([100]);
    });

    it('returns all possible sums for small proof set', () => {
        const proofs = [makeProof(1), makeProof(2), makeProof(4)];
        const result = getPossibleAmounts(proofs);
        expect(result).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('handles duplicate amounts', () => {
        const proofs = [makeProof(5), makeProof(5)];
        const result = getPossibleAmounts(proofs);
        expect(result).toEqual([5, 10]);
    });

    it('never includes 0', () => {
        const proofs = [makeProof(100)];
        expect(getPossibleAmounts(proofs)).not.toContain(0);
    });

    it('returns sorted results', () => {
        const proofs = [makeProof(50), makeProof(10), makeProof(100)];
        const result = getPossibleAmounts(proofs);
        for (let i = 1; i < result.length; i++) {
            expect(result[i]).toBeGreaterThanOrEqual(result[i - 1]);
        }
    });

    it('caps around 128 entries for performance', () => {
        const proofs = Array.from({ length: 20 }, (_, i) => makeProof(i + 1));
        const result = getPossibleAmounts(proofs);
        expect(result.length).toBeLessThanOrEqual(200);
    });
});

describe('findExactSubset', () => {
    it('returns null for empty proofs', () => {
        expect(findExactSubset(100, [])).toBeNull();
    });

    it('returns null when no combination exists', () => {
        const proofs = [makeProof(10), makeProof(20)];
        expect(findExactSubset(15, proofs)).toBeNull();
    });

    it('finds exact match with single proof', () => {
        const proofs = [makeProof(100), makeProof(50)];
        const result = findExactSubset(100, proofs);
        expect(result).not.toBeNull();
        expect(result!.reduce((sum, p) => sum + p.amount, 0)).toBe(100);
    });

    it('finds exact match with multiple proofs', () => {
        const proofs = [makeProof(50), makeProof(30), makeProof(20)];
        const result = findExactSubset(100, proofs);
        expect(result).not.toBeNull();
        expect(result!.reduce((sum, p) => sum + p.amount, 0)).toBe(100);
    });

    it('returns empty array for target 0', () => {
        const proofs = [makeProof(100)];
        const result = findExactSubset(0, proofs);
        expect(result).not.toBeNull();
        expect(result!.reduce((sum, p) => sum + p.amount, 0)).toBe(0);
    });
});

describe('findClosestSubsetOptions', () => {
    it('returns all null for empty proofs', () => {
        expect(findClosestSubsetOptions(100, [])).toEqual({
            lower: null,
            exact: null,
            higher: null,
        });
    });

    it('returns all null for target 0', () => {
        expect(findClosestSubsetOptions(0, [makeProof(100)])).toEqual({
            lower: null,
            exact: null,
            higher: null,
        });
    });

    it('finds exact match', () => {
        const proofs = [makeProof(50), makeProof(50)];
        const result = findClosestSubsetOptions(100, proofs);
        expect(result.exact).not.toBeNull();
        expect(result.exact!.amount).toBe(100);
    });

    it('finds lower when no exact match', () => {
        const proofs = [makeProof(30), makeProof(20)];
        const result = findClosestSubsetOptions(40, proofs);
        expect(result.exact).toBeNull();
        expect(result.lower).not.toBeNull();
        expect(result.lower!.amount).toBe(30);
    });

    it('finds higher when no exact match', () => {
        const proofs = [makeProof(50), makeProof(30)];
        const result = findClosestSubsetOptions(40, proofs);
        expect(result.exact).toBeNull();
        expect(result.higher).not.toBeNull();
        expect(result.higher!.amount).toBe(50);
    });

    it('finds both lower and higher for non-exact match', () => {
        const proofs = [makeProof(50), makeProof(30), makeProof(10)];
        const result = findClosestSubsetOptions(45, proofs);
        expect(result.exact).toBeNull();
        expect(result.lower!.amount).toBe(40);
        expect(result.higher!.amount).toBe(50);
    });
});
