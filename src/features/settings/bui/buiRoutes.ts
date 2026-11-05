export const buiPreviewRoutes = {
  1: '/(tabs)/settings/new-ui-colors',
  2: '/(tabs)/settings/bui-layout',
  3: '/(tabs)/settings/bui-typography',
  4: '/(tabs)/settings/bui-icons-avatars',
  5: '/(tabs)/settings/bui-badges',
  6: '/(tabs)/settings/new-ui-buttons',
  7: '/(tabs)/settings/bui-forms',
  8: '/(tabs)/settings/bui-selections',
  9: '/(tabs)/settings/bui-tabs-chips',
  10: '/(tabs)/settings/bui-lists',
  11: '/(tabs)/settings/bui-cards',
  12: '/(tabs)/settings/bui-navigation',
  13: '/(tabs)/settings/bui-sheets',
  14: '/(tabs)/settings/bui-menus',
} as const;

export const buiRouteNames = [
  'new-ui',
  ...Object.values(buiPreviewRoutes).map((route) => route.split('/').pop()!),
];
