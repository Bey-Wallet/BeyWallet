import type { CoreProof } from 'coco-cashu-core';

/**
 * Returns all possible exact amounts that can be created with the given set of proofs.
 * To avoid performance issues with large numbers of proofs, we limit the maximum unique sums to 128.
 */
export function getPossibleAmounts(proofs: CoreProof[]): number[] {
    const amounts = proofs.map(p => p.amount);
    const possible = new Set<number>();
    
    possible.add(0);
    for (const amt of amounts) {
        const currentSums = Array.from(possible);
        for (const sum of currentSums) {
            possible.add(sum + amt);
        }
        if (possible.size > 128) break; // prevent infinite/exponential growth
    }
    
    possible.delete(0); // remove 0 since a transaction of 0 is not valid
    return Array.from(possible).sort((a, b) => a - b);
}

/**
 * Find a subset of proofs that sums up exactly to the target amount.
 * Returns the array of proofs, or null if no combination exists.
 */
export function findExactSubset(target: number, proofs: CoreProof[]): CoreProof[] | null {
    const result: CoreProof[] = [];
    
    const search = (index: number, currentSum: number): boolean => {
        if (currentSum === target) return true;
        if (currentSum > target || index >= proofs.length) return false;
        
        // Option 1: Include proofs[index]
        result.push(proofs[index]);
        if (search(index + 1, currentSum + proofs[index].amount)) return true;
        result.pop(); // backtrack
        
        // Option 2: Exclude proofs[index]
        if (search(index + 1, currentSum)) return true;
        
        return false;
    };

    // Sort descending to choose larger proofs first and speed up search
    const sorted = [...proofs].sort((a, b) => b.amount - a.amount);
    if (search(0, 0)) return result;
    return null;
}
