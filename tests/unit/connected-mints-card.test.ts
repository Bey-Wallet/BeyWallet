import {
  getMintPlaceholders,
  RECOMMENDED_MINTS,
} from '~/features/home/components/mintPlaceholders';

describe('ConnectedMintsCard placeholders', () => {
  it('fills an empty card with all four recommended mints', () => {
    expect(getMintPlaceholders([])).toEqual(RECOMMENDED_MINTS);
  });

  it.each(['https://mint.minibits.cash/Bitcoin/', 'https://custom.example'])(
    'hides recommendations once a mint is connected (%s)',
    (mintUrl) => {
      expect(getMintPlaceholders([{ mintUrl }])).toEqual([]);
    },
  );

  it('does not fill gaps when multiple mints are connected', () => {
    expect(
      getMintPlaceholders([
        { mintUrl: RECOMMENDED_MINTS[0].mintUrl },
        { mintUrl: RECOMMENDED_MINTS[1].mintUrl },
      ]),
    ).toEqual([]);
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
