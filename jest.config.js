/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/.*|native-base|react-native-svg|react-native-reanimated|react-native-gesture-handler|react-native-screens|react-native-safe-area-context|@gorhom/bottom-sheet|tamagui|@tamagui/.*|@shopify/flash-list|nostr-tools|@cashu/.*|coco-cashu-.*|@noble/.*|@scure/.*|cbor-x|bech32|bip39|buffer)/',
  ],
  moduleNameMapper: {
    '^~/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/\\.yarn/', '/scratch/'],
  collectCoverageFrom: [
    'src/services/**/*.ts',
    'src/utils/**/*.ts',
    'src/store/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/test/**',
  ],
};
