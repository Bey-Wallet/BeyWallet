const { AndroidConfig, withAndroidStyles } = require('@expo/config-plugins');

// Keep the navigation area transparent over the app's own themed background.
module.exports = (config) =>
  withAndroidStyles(config, (mod) => {
    mod.modResults = AndroidConfig.Styles.assignStylesValue(mod.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: 'android:enforceNavigationBarContrast',
      value: 'false',
    });
    return mod;
  });
