import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const violations = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(filename);
      continue;
    }
    if (!/\.tsx?$/.test(filename)) continue;
    if (filename.replaceAll('\\', '/') === 'src/shared/ui/AppButton.tsx') continue;
    const source = ts.createSourceFile(
      filename,
      fs.readFileSync(filename, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const namespaces = new Set();
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement)) continue;
      const module = statement.moduleSpecifier.text;
      if (!['tamagui', '@tamagui/button'].includes(module)) continue;
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
      if (
        (bindings &&
          ts.isNamedImports(bindings) &&
          bindings.elements.some(
            (binding) => (binding.propertyName ?? binding.name).text === 'Button',
          )) ||
        (module === '@tamagui/button' && statement.importClause?.name)
      ) {
        violations.push(`${filename}: import AppButton or AppPressable instead of Tamagui Button`);
      }
    }
    function visit(node) {
      if (
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        (node.tagName.getText(source) === 'Button' ||
          (ts.isPropertyAccessExpression(node.tagName) &&
            namespaces.has(node.tagName.expression.getText(source)) &&
            node.tagName.name.text === 'Button'))
      ) {
        violations.push(
          `${filename}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: raw Button usage`,
        );
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}

walk('src');
if (violations.length) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Button check passed: Tamagui Button is confined to AppButton.');
}
