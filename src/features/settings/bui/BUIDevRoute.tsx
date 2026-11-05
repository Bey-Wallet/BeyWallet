import React from 'react';
import { Redirect } from 'expo-router';
import { isDevelopmentClient } from '~/shared/utils/developmentClient';

/** Guard each entry independently so direct links cannot mount a release preview. */
export function createBUIDevRoute(load: () => React.ComponentType) {
  let Screen: React.ComponentType | undefined;
  return function BUIDevRoute() {
    if (!isDevelopmentClient()) return <Redirect href="/(tabs)/settings" />;
    Screen ??= load();
    return <Screen />;
  };
}
