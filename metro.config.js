// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config')
const { withTamagui } = require('@tamagui/metro-plugin')

const config = getDefaultConfig(__dirname)

config.resolver.unstable_enablePackageExports = true
config.resolver.sourceExts.push('mjs')
config.resolver.assetExts.push('wasm')

// withTamagui loads your tamagui config and watches for changes in dev
module.exports = withTamagui(config, {
  components: ['tamagui'],
  config: './src/tamagui.config.ts',
})
