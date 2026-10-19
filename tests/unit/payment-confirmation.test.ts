import { PaymentConfirmation } from '~/services/wallet/paymentConfirmation';

it('executes without requesting disabled biometrics', async () => {
  const authenticate = jest.fn();
  const execute = jest.fn();
  await expect(
    new PaymentConfirmation().confirm({ biometricEnabled: false, authenticate, execute }),
  ).resolves.toBe(true);
  expect(authenticate).not.toHaveBeenCalled();
  expect(execute).toHaveBeenCalledTimes(1);
});

it.each([false, true])('requires enabled authentication (%s)', async (success) => {
  const authenticate = jest.fn().mockResolvedValue(success);
  const execute = jest.fn();
  await expect(
    new PaymentConfirmation().confirm({ biometricEnabled: true, authenticate, execute }),
  ).resolves.toBe(success);
  expect(execute).toHaveBeenCalledTimes(success ? 1 : 0);
});

it('prevents execution after an authentication error', async () => {
  const execute = jest.fn();
  await expect(
    new PaymentConfirmation().confirm({
      biometricEnabled: true,
      authenticate: async () => {
        throw new Error('Authentication failed');
      },
      execute,
    }),
  ).rejects.toThrow('Authentication failed');
  expect(execute).not.toHaveBeenCalled();
});

it('shares concurrent actions across the authentication prompt', async () => {
  let resolve!: (value: boolean) => void;
  const authenticate = jest.fn(
    () =>
      new Promise<boolean>((r) => {
        resolve = r;
      }),
  );
  const execute = jest.fn();
  const confirmation = new PaymentConfirmation();
  const options = { biometricEnabled: true, authenticate, execute };
  const first = confirmation.confirm(options);
  expect(confirmation.confirm(options)).toBe(first);
  resolve(true);
  await first;
  expect(authenticate).toHaveBeenCalledTimes(1);
  expect(execute).toHaveBeenCalledTimes(1);
});
