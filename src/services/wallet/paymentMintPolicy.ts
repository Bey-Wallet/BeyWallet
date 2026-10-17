export type PaymentMintMethod =
  'mint-lightning' | 'melt-lightning' | 'mint-onchain' | 'melt-onchain' | 'p2pk';

export function supportsPaymentMethod(info: unknown, method: PaymentMintMethod): boolean {
  const nuts = (info as { nuts?: Record<string, any> } | null)?.nuts;
  if (!nuts) return false;
  if (method === 'p2pk') return nuts['11']?.supported === true;
  const nut = nuts[method.startsWith('mint') ? '4' : '5'];
  if (nut?.disabled === true) return false;
  if (method === 'melt-onchain') {
    return (
      nuts['30']?.supported === true ||
      nuts['30']?.methods?.some((m: any) => m.unit === 'sat' && m.method === 'onchain') === true ||
      nut?.methods?.some((m: any) => m.unit === 'sat' && m.method === 'onchain') === true
    );
  }
  return (
    nut?.methods?.some(
      (m: any) =>
        m.unit === 'sat' && m.method === (method.endsWith('onchain') ? 'onchain' : 'bolt11'),
    ) === true
  );
}
