import fs from 'fs';
import path from 'path';

const source = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
it.each([
  'src/app/(tabs)/_layout.tsx',
  'src/features/payments/receive/InputStage.tsx',
  'src/features/payments/send/ScanAndPayStage.tsx',
])('routes the reader shortcut through the shared flow: %s', (file) => {
  expect(source(file)).toContain('nfcFlow.openReader');
  expect(source(file)).not.toContain('/(modals)/nfc-receive');
});
it('uses the common token layout for send results, shared tokens and proof-created tokens', () => {
  for (const file of [
    'src/features/payments/send/ResultStage.tsx',
    'src/features/history/TransactionDetailsScreen.tsx',
    'src/features/payments/ProofsScreen.tsx',
  ]) {
    expect(source(file)).toContain('PendingTokenLayout');
  }
  const layout = source('src/shared/ui/PendingTokenLayout.tsx');
  expect(layout).toContain('nfcFlow.openSend');
  expect(layout).toContain('pendingNfc.current = true');
  expect(layout).not.toContain('writeNdefTag');
  expect(fs.existsSync(path.join(process.cwd(), 'src/app/(modals)/nfc-send.tsx'))).toBe(false);
  expect(fs.existsSync(path.join(process.cwd(), 'src/app/(modals)/nfc-receive.tsx'))).toBe(false);
});
