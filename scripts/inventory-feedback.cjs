/* Source index for the feedback audit. No application/user data is read. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? files(file) : /\.tsx?$/.test(file) ? [file] : [];
  });
}
const inventory = [];
for (const file of files('src').sort()) {
  const source = fs.readFileSync(file, 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const relative = file.replaceAll('\\', '/');
  const occurrences = new Map();
  function record(node, type, trigger, scope) {
    const line = tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
    const body = scope?.getText(tree) || node.getText(tree);
    const feedback = [
      ...new Set(
        body.match(
          /(?:toast\.(?:showFeedback|show|copy|openExternal)|publishWalletFeedback|set\w*Error|set\w*Status|Alert\.alert|Haptics\.\w+|setCopied|setMessage|setLocalError|setStep)/g,
        ) || [],
      ),
    ];
    const financial =
      /payments\/|supporter\/|reclaim|Payment|Claim|lightningAddress|nostrClaim/.test(relative);
    const passive =
      /nostrService|nostrClaimService|lightningAddressService|useCocoEvents|mintTransferService/.test(
        relative,
      ) && body.includes('publishWalletFeedback');
    const navigation =
      type === 'route' ||
      /router\.(push|back|replace|navigate)|setStep|onBack|onClose|setSelected|onCheckedChange/.test(
        trigger,
      );
    const clipboard =
      /copy|clipboard|paste/i.test(trigger) ||
      /toast\.copy|copyWithFeedback|Clipboard\.(?:get|set)String|\btask\.copy|\boperation\.copy/.test(
        body,
      );
    const destructive = /delete|destroy|remove|reclaim/i.test(trigger);
    const result = financial && !clipboard && !navigation;
    const owner = passive
      ? 'coordinator: focused owner, otherwise toast or private OS notification'
      : navigation
        ? 'visible destination/selection'
        : destructive
          ? 'confirmation then local result/error'
          : result
            ? 'active operation progress/result screen'
            : clipboard
              ? 'local copy/paste state or compact toast'
              : type === 'async' && relative.startsWith('src/services/')
                ? 'calling operation; internal work is quiet'
                : 'local field/inline status; compact toast for transient utility outcomes';
    const disposition =
      /NotificationSettingsScreen|useAppFeedback|services\/feedback|settings\/notifications/.test(
        relative,
      )
        ? 'add'
        : navigation || (type === 'async' && relative.startsWith('src/services/') && !passive)
          ? 'intentionally quiet'
          : passive || clipboard
            ? 'change'
            : 'keep';
    const base = `${relative}:${type}:${trigger}`;
    const ordinal = (occurrences.get(base) || 0) + 1;
    occurrences.set(base, ordinal);
    inventory.push({
      id: `${base}:${ordinal}`,
      source: `${relative}:${line}`,
      type,
      trigger,
      authoritativeOutcome: passive
        ? 'verified domain result saved before publish; arrival/review is not success'
        : result
          ? 'confirmed saved wallet result; pending/unknown remains pending'
          : navigation
            ? 'destination or selected state is visible'
            : clipboard
              ? 'native clipboard/share/save promise resolves; cancellation remains quiet'
              : destructive
                ? 'explicit confirmation, then operation resolves'
                : type === 'async'
                  ? 'resolved operation; rejection stays with caller'
                  : 'handler completes and visible state reflects outcome',
      currentFeedback: feedback.length
        ? feedback
        : ['visible state/touch feedback or caller-owned'],
      intendedOwner: owner,
      disposition,
      copy: passive
        ? 'feedbackCatalog; private OS default'
        : clipboard
          ? 'interactionCopy; success only after native completion'
          : result
            ? 'existing result screen; accurate pending/completed state'
            : navigation
              ? 'none'
              : 'local screen copy; safe correction or retry',
      severity: navigation
        ? 'none'
        : result || passive
          ? 'explicit semantic outcome'
          : 'info; error only on verified failure',
      action: destructive
        ? 'confirm/cancel before execution'
        : passive
          ? 'View (navigation only)'
          : navigation
            ? 'navigate/select'
            : 'correct input or retry safely',
      verification:
        'source-indexed; see feedback-revamp.md and interaction-feedback.md for automated coverage and pending device checks',
    });
  }
  if (relative.startsWith('src/app/')) record(tree, 'route', relative, tree);
  function visit(node, scope = tree) {
    const functionNode =
      ts.isFunctionDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node) ||
      ts.isMethodDeclaration(node);
    if (functionNode) {
      scope = node;
      if (node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)) {
        const parent = node.parent;
        const name = node.name?.getText(tree) || parent?.name?.getText(tree) || 'callback';
        record(node, 'async', name, node);
      }
    }
    if (
      ts.isJsxAttribute(node) &&
      /^(onPress|onLongPress|onChangeText|onCheckedChange|onSubmitEditing|onValueChange|onAction|onConfirm|onCancel|onRetry|onCopy|onShare|onSave|onContinue|onComplete|onSuccess|onError|onBack|onClose)$/.test(
        node.name.getText(tree),
      )
    ) {
      record(
        node,
        'control',
        `${node.name.getText(tree)}: ${node.initializer?.getText(tree).replace(/\s+/g, ' ').slice(0, 140) || 'handler'}`,
        scope,
      );
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (/Sheet|Dialog|Modal/.test(node.tagName.getText(tree)))
        record(node, 'sheet', node.tagName.getText(tree), scope);
    }
    ts.forEachChild(node, (child) => visit(child, scope));
  }
  visit(tree);
}
fs.writeFileSync(
  'docs/feedback-interactions.jsonl',
  inventory.map((row) => JSON.stringify(row)).join('\n') + '\n',
);
console.log(
  JSON.stringify({
    total: inventory.length,
    byType: inventory.reduce(
      (counts, row) => ({ ...counts, [row.type]: (counts[row.type] || 0) + 1 }),
      {},
    ),
  }),
);
