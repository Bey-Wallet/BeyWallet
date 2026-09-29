import {
  getMintPlaceholders,
  RECOMMENDED_MINTS,
} from '~/features/home/components/mintPlaceholders';

describe('ConnectedMintsCard placeholders', () => {
  it('fills an empty card with all four recommended mints', () => {
    expect(getMintPlaceholders([])).toEqual(RECOMMENDED_MINTS);
  });

  it('does not duplicate Minibits when it is already connected', () => {
    const placeholders = getMintPlaceholders([{ mintUrl: 'https://mint.minibits.cash/Bitcoin/' }]);

    expect(placeholders).toHaveLength(3);
    expect(placeholders.some((mint) => mint.name === 'Minibits Mint')).toBe(false);
  });

  it('shows two placeholders for two connected mints and one for three', () => {
    expect(
      getMintPlaceholders([
        { mintUrl: RECOMMENDED_MINTS[0].mintUrl },
        { mintUrl: RECOMMENDED_MINTS[1].mintUrl },
      ]),
    ).toHaveLength(2);

    expect(
      getMintPlaceholders([
        { mintUrl: RECOMMENDED_MINTS[0].mintUrl },
        { mintUrl: RECOMMENDED_MINTS[1].mintUrl },
        { mintUrl: RECOMMENDED_MINTS[2].mintUrl },
      ]),
    ).toHaveLength(1);
  });

  it('does not show placeholders once four mints are connected', () => {
    expect(
      getMintPlaceholders([
        { mintUrl: 'https://one.example' },
        { mintUrl: 'https://two.example' },
        { mintUrl: 'https://three.example' },
        { mintUrl: 'https://four.example' },
      ]),
    ).toEqual([]);
  });
});
