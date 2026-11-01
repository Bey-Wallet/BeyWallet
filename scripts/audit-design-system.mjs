import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// These are review candidates, not violations: artwork, animation geometry, and optical
// adjustments may legitimately use literals. Audit UI code against Bey's existing system.
const roots = ['src/app', 'src/features', 'src/shared/ui'];
const categories = ['colors', 'typography', 'spacing', 'radius', 'motion', 'shadows'];
const spacingNames =
  /^(?:p[trblxy]?|m[trblxy]?|gap|rowGap|columnGap|padding(?:Top|Right|Bottom|Left|Horizontal|Vertical)?|margin(?:Top|Right|Bottom|Left|Horizontal|Vertical)?)$/;
const colorNames =
  /^(?:bg|color|backgroundColor|border(?:Top|Right|Bottom|Left)?Color|shadowColor|fill|stroke)$/;
const findings = Object.fromEntries(categories.map((name) => [name, []]));
let lines = 0;
let files = 0;
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(filename) : /\.tsx?$/.test(filename) ? [filename] : [];
  });
}
for (const filename of roots.flatMap(walk).sort()) {
  const text = fs.readFileSync(filename, 'utf8');
  lines += text.split(/\r?\n/).length;
  files++;
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true);
  function visit(node) {
    let name, value;
    if (ts.isJsxAttribute(node) && node.initializer) {
      name = node.name.getText(source);
      value = ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer;
    } else if (ts.isPropertyAssignment(node)) {
      name = node.name.getText(source).replace(/^['"]|['"]$/g, '');
      value = node.initializer;
    }
    if (value && name) {
      const numeric = ts.isNumericLiteral(value);
      const string = ts.isStringLiteral(value);
      const category =
        colorNames.test(name) && string && /^#[\da-f]{3,8}$/i.test(value.text)
          ? 'colors'
          : name === 'fontSize' && numeric
            ? 'typography'
            : spacingNames.test(name) && numeric && Number(value.text) !== 0
              ? 'spacing'
              : /^(?:rounded|borderRadius)$/.test(name) && numeric && Number(value.text) !== 0
                ? 'radius'
                : name === 'duration' && numeric && Number(value.text) !== 0
                  ? 'motion'
                  : /^(?:shadowColor|shadowOffset|shadowOpacity|shadowRadius|elevation)$/.test(name)
                    ? 'shadows'
                    : null;
      if (category)
        findings[category].push({
          file: filename.replaceAll('\\', '/'),
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          property: name,
          value: value.getText(source),
        });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
const summary = categories.map((category) => {
  const candidates = findings[category];
  const counts = new Map();
  for (const { file } of candidates) counts.set(file, (counts.get(file) ?? 0) + 1);
  return {
    category,
    count: candidates.length,
    per100Lines: Number(((candidates.length / lines) * 100).toFixed(1)),
    topFiles: [...counts].sort((a, b) => b[1] - a[1]).slice(0, 5),
  };
});
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ roots, files, lines, summary, findings }, null, 2));
} else {
  console.log(
    `# Bey UI token audit\n\n${files} files, ${lines} source lines. Scope: ${roots.join(', ')}.\n`,
  );
  console.log(
    'Review candidates only; values are not automatically defects. Theme/config definitions are excluded.',
  );
  console.log(
    '\n| Category | Literal candidates | Per 100 lines | Top files |\n|---|---:|---:|---|',
  );
  for (const row of summary)
    console.log(
      `| ${row.category} | ${row.count} | ${row.per100Lines.toFixed(1)} | ${row.topFiles.map(([file, count]) => `${file} (${count})`).join(', ')} |`,
    );
  console.log('\nUse --json for the complete file/line inventory.');
}
