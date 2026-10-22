let mockApplyStyles: (config: any) => any;
jest.mock('@expo/config-plugins', () => ({
  ...jest.requireActual('@expo/config-plugins'),
  withAndroidStyles: (config: any, callback: typeof mockApplyStyles) => {
    mockApplyStyles = callback;
    return config;
  },
}));

const withNavigationBarContrast = require('../../plugins/withNavigationBarContrast');

it('disables system shading during prebuild without replacing the native app theme', () => {
  const mod: any = {
    modResults: {
      resources: {
        style: [
          {
            $: { name: 'AppTheme', parent: 'Theme.Material3Expressive.DayNight.NoActionBar' },
            item: [
              { $: { name: 'android:enforceNavigationBarContrast' }, _: 'true' },
              { $: { name: 'android:editTextBackground' }, _: '@drawable/rn_edit_text_material' },
            ],
          },
        ],
      },
    },
  };
  withNavigationBarContrast({});
  mockApplyStyles(mod);
  mockApplyStyles(mod);
  const theme = mod.modResults.resources.style[0];
  expect(theme.$.parent).toBe('Theme.Material3Expressive.DayNight.NoActionBar');
  expect(
    theme.item.filter((item: any) => item.$.name === 'android:enforceNavigationBarContrast'),
  ).toEqual([{ $: { name: 'android:enforceNavigationBarContrast' }, _: 'false' }]);
  expect(theme.item.find((item: any) => item.$.name === 'android:editTextBackground')._).toBe(
    '@drawable/rn_edit_text_material',
  );
});
