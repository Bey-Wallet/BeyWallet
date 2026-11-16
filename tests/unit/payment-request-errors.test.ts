import { decodePaymentRequest } from '~/services/wallet/tokenUtils';

const mockDecode = jest.fn();
jest.mock('@cashu/cashu-ts', () => ({
  ...jest.requireActual('@cashu/cashu-ts'),
  PaymentRequest: { fromEncodedRequest: (...args: unknown[]) => mockDecode(...args) },
}));

it('replaces decoder errors that may quote the original payment request', () => {
  const secret = 'synthetic-private-request-data';
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    mockDecode.mockImplementationOnce(() => {
      throw new SyntaxError(`Could not decode ${secret}`);
    });
    let failure: any;
    try {
      decodePaymentRequest('creqA-synthetic');
    } catch (error) {
      failure = error;
    }
    expect(failure.message).toBe('Invalid payment request format.');
    expect(failure.cause).toBeUndefined();
    expect(JSON.stringify(warning.mock.calls)).not.toContain(secret);
  } finally {
    warning.mockRestore();
  }
});
