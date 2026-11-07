import Constants, { ExecutionEnvironment } from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

/** BUI is available only in the native debug client, never in release, Expo Go or web. */
export function isDevelopmentClient() {
  return (
    __DEV__ &&
    Platform.OS !== 'web' &&
    Constants.executionEnvironment !== ExecutionEnvironment.StoreClient &&
    requireOptionalNativeModule('ExpoDevMenu') != null
  );
}
