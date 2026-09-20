jest.mock('coco-cashu-core', () => ({
  getDecodedToken: jest.fn(),
  getEncodedToken: jest.fn(),
}));
jest.mock('@cashu/cashu-ts', () => ({
  getDecodedToken: jest.fn(),
  getEncodedTokenV4: jest.fn(),
  PaymentRequest: { fromEncodedRequest: jest.fn() },
}));

import { cleanToken, extractPeanut } from '../../src/services/wallet/tokenUtils';

describe('token normalization', () => {
  it('extracts and cleans Cashu token text', () => {
    expect(extractPeanut('pay cashuAabc now')).toBeNull();
    expect(cleanToken('cashu:cashuAabc')).toBe('cashuAabc');
  });
});
