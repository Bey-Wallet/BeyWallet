import React from 'react';
import { act, create } from 'react-test-renderer';
import { RecoverFundsLegacyRoute } from '~/features/settings/RecoverFundsLegacyRoute';

let mockParams: { mintUrl?: string } = {};
jest.mock('expo-router', () => ({
  Redirect: 'Redirect',
  useLocalSearchParams: () => mockParams,
}));

it.each([undefined, 'https://mint.test'])(
  'keeps legacy recovery links and mint selection (%s)',
  async (mintUrl) => {
    mockParams = { mintUrl };
    let tree!: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<RecoverFundsLegacyRoute />);
    });
    expect(tree.root.findByType('Redirect' as any).props.href).toEqual({
      pathname: '/recover-funds',
      params: mintUrl ? { mintUrl } : {},
    });
    await act(async () => tree.unmount());
  },
);
