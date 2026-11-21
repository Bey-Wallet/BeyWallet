import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

it('routes app logging through the safe logger rather than direct console calls', () => {
  const allowed = new Set(['shared/utils/appLogger.ts', 'shared/utils/dependencyConsoleGuard.ts']);
  const debugTraces = new Set([
    'features/nfc/nfcFlow.ts',
    'services/wallet/walletLogger.ts',
    'services/wallet/recoveryCoordinator.ts',
    'services/wallet/seedRecovery.ts',
  ]);
  const failures: string[] = [];
  const walk = (dir: string) => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) {
        walk(file);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(file)) continue;
      const relative = path.relative(path.join(process.cwd(), 'src'), file).replaceAll('\\', '/');
      if (allowed.has(relative)) continue;
      const source = ts.createSourceFile(
        file,
        fs.readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      const visit = (node: ts.Node) => {
        if (
          ts.isCallExpression(node) &&
          node.expression.getText(source) === 'appLogger.debug' &&
          !debugTraces.has(relative)
        )
          failures.push(`${relative}: routine debug logging`);
        if (
          (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
          node.expression.getText(source) === 'console'
        )
          failures.push(
            `${relative}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`,
          );
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  };
  walk(path.join(process.cwd(), 'src'));
  expect(failures).toEqual([]);
});
