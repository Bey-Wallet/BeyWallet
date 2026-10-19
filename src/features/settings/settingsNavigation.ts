export type SettingsOriginTab = 'index' | 'history' | 'people';
let origin: SettingsOriginTab = 'index';

export function rememberSettingsOrigin(name: string) {
  if (name === 'index' || name === 'history' || name === 'people') origin = name;
}

export function settingsReturnPath() {
  return origin === 'index' ? ('/(tabs)' as const) : (`/(tabs)/${origin}` as const);
}

export function settingsTabIsActive(routeName: string) {
  return routeName === 'settings';
}
