export const SUPPORT_LIGHTNING_ADDRESS = 'beywallet@blitzwalletapp.com';

export const SUPPORT_PAYMENT_ROUTE = {
  pathname: '/(modals)/melt' as const,
  params: { lightningAddress: SUPPORT_LIGHTNING_ADDRESS, source: 'support' },
};
