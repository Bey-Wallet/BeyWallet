import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { isDevelopmentClient } from '~/shared/utils/developmentClient';
import { createBUIDevRoute } from '~/features/settings/bui/BUIDevRoute';
import { buiCatalog } from '~/features/settings/bui/buiCatalog';
import { buiPreviewRoutes, buiRouteNames } from '~/features/settings/bui/buiRoutes';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'bare' },
  ExecutionEnvironment: { StoreClient: 'storeClient' },
}));
jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: jest.fn() }));
jest.mock('expo-router', () => {
  const React = require('react');
  return { Redirect: (props: object) => React.createElement('Redirect', props) };
});

const originalDev = Object.getOwnPropertyDescriptor(globalThis, '__DEV__');
const originalPlatform = Object.getOwnPropertyDescriptor(Platform, 'OS')!;
beforeEach(() => {
  Object.defineProperty(globalThis, '__DEV__', { configurable: true, writable: true, value: true });
  Object.defineProperty(Platform, 'OS', { ...originalPlatform, value: 'android' });
  (Constants as { executionEnvironment: string }).executionEnvironment = 'bare';
  jest.mocked(requireOptionalNativeModule).mockReturnValue({});
});
afterEach(() => {
  if (originalDev) Object.defineProperty(globalThis, '__DEV__', originalDev);
  Object.defineProperty(Platform, 'OS', originalPlatform);
  jest.clearAllMocks();
});

it('requires native debug client access and rejects release, Expo Go, web and missing native support', () => {
  expect(isDevelopmentClient()).toBe(true);
  Object.defineProperty(globalThis, '__DEV__', { value: false });
  expect(isDevelopmentClient()).toBe(false);
  Object.defineProperty(globalThis, '__DEV__', { value: true });
  (Constants as { executionEnvironment: string }).executionEnvironment = 'storeClient';
  expect(isDevelopmentClient()).toBe(false);
  (Constants as { executionEnvironment: string }).executionEnvironment = 'bare';
  Object.defineProperty(Platform, 'OS', { value: 'web' });
  expect(isDevelopmentClient()).toBe(false);
  Object.defineProperty(Platform, 'OS', { value: 'android' });
  jest.mocked(requireOptionalNativeModule).mockReturnValue(null);
  expect(isDevelopmentClient()).toBe(false);
});

it('redirects blocked deep links without loading the preview module', async () => {
  Object.defineProperty(globalThis, '__DEV__', { value: false });
  const load = jest.fn(() => () => React.createElement('Preview'));
  const Route = createBUIDevRoute(load);
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(<Route />);
    });
    expect(load).not.toHaveBeenCalled();
    expect(tree!.toJSON()).toMatchObject({ type: 'Redirect', props: { href: '/(tabs)/settings' } });
    Object.defineProperty(globalThis, '__DEV__', { value: true });
    await act(async () => tree!.update(<Route />));
    expect(load).toHaveBeenCalledTimes(1);
    expect(tree!.toJSON()).toMatchObject({ type: 'Preview' });
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

it('retains only foundations, core components and navigation/overlays with a route for every group', () => {
  expect(buiCatalog.map((section) => section.title)).toEqual([
    'Foundations',
    'Core components',
    'Navigation & overlays',
  ]);
  const groups = buiCatalog.flatMap((section) => section.items.map((item) => item.number));
  expect(groups).toHaveLength(14);
  expect(groups).toEqual(Array.from({ length: 14 }, (_, index) => index + 1));
  expect(Object.keys(buiPreviewRoutes)).toHaveLength(14);
  expect(buiRouteNames).toHaveLength(15);
});
