import { OutputData } from '@cashu/cashu-ts';
import { createRecoveryOutputDeriver, recoveryOutputs } from '~/services/wallet/recoveryOutputs';

const seed = Uint8Array.from({ length: 64 }, (_, index) => index + 1);
const previous = require('../../node_modules/coco-cashu-core/node_modules/@cashu/cashu-ts/lib/cashu-ts.cjs');
it.each(['0011223344556677', 'ABEiM0RVZnc=', '01' + '11'.repeat(32)])(
  'preserves secret, blinding factor and blinded output bytes for %s',
  (id) => {
    const derive = createRecoveryOutputDeriver(seed, id);
    for (const counter of [0, 1, 199, 200, 999]) {
      const expected = OutputData.createSingleDeterministicData(0, seed, counter, id);
      const actual = derive(counter);
      expect(actual.secret).toEqual(expected.secret);
      expect(actual.blindingFactor).toEqual(expected.blindingFactor);
      expect(actual.blindedMessage).toEqual(expected.blindedMessage);
      const old = previous.OutputData.createSingleDeterministicData(0, seed, counter, id);
      expect(actual.secret).toEqual(old.secret);
      expect(actual.blindingFactor).toEqual(old.blindingFactor);
      expect(actual.blindedMessage).toEqual(old.blindedMessage);
    }
  },
);
it('yields between small groups instead of constructing the entire batch synchronously', async () => {
  const derive = jest.fn(createRecoveryOutputDeriver(seed, '0011223344556677'));
  const pending = recoveryOutputs(derive, 0, 16);
  expect(derive).not.toHaveBeenCalled();
  expect(await pending).toHaveLength(16);
});
it('rejects out-of-range legacy counters', () => {
  const derive = createRecoveryOutputDeriver(seed, '0011223344556677');
  expect(() => derive(0x80000000)).toThrow('counter');
});
it('preserves output counters across batch boundaries', async () => {
  const derive = createRecoveryOutputDeriver(seed, '0011223344556677');
  const outputs = await recoveryOutputs(derive, 200, 16);
  expect(outputs[0].blindedMessage).toEqual(derive(200).blindedMessage);
  expect(outputs[15].blindedMessage).toEqual(derive(215).blindedMessage);
});
