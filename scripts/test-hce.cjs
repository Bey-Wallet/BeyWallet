const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const output = path.resolve('.tmp/hce-tests');
fs.mkdirSync(output, { recursive: true });
const executable = (name) =>
  process.env.JAVA_HOME
    ? path.join(process.env.JAVA_HOME, 'bin', name + (process.platform === 'win32' ? '.exe' : ''))
    : name;
for (const [name, args] of [
  [
    'javac',
    [
      '-d',
      output,
      'node_modules/react-native-hce/android/src/main/java/com/reactnativehce/apps/nfc/Type4File.java',
      'tests/unit/native/Type4FileTest.java',
    ],
  ],
  ['java', ['-cp', output, 'Type4FileTest']],
]) {
  const result = spawnSync(executable(name), args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
