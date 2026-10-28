import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { NavigationContext } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useFeedbackOwner } from '~/shared/hooks/useFeedbackOwner';
import { feedbackCoordinator, type FeedbackEvent } from '~/services/feedback/feedbackCoordinator';

jest.mock('@react-navigation/native', () => ({
  NavigationContext: require('react').createContext(undefined),
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));
const event: FeedbackEvent = {
  walletId: 'wallet',
  entity: { type: 'receipt', id: 'receipt-1' },
  parentOperationId: 'operation-1',
  kind: 'received',
  state: 'completed',
  origin: 'live',
};
function Screen() {
  useFeedbackOwner('operation-1');
  return <>{'Result'}</>;
}
let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  feedbackCoordinator.clear();
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  feedbackCoordinator.clear();
});

it('produces one screen-owned haptic for SDK/service/screen duplicates and switches owner on blur', async () => {
  const markers = new Set<string>();
  feedbackCoordinator.bind('wallet', {
    reserve: async (_event, key) => {
      if (markers.has(key)) return false;
      markers.add(key);
      return true;
    },
  });
  const toast = jest.fn(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  });
  const notification = jest.fn();
  const disconnect = feedbackCoordinator.connect({
    foreground: () => true,
    unlocked: () => true,
    toast,
    notification,
  });
  const listeners = new Map<string, () => void>();
  const navigation = {
    isFocused: () => true,
    addListener: (name: string, callback: () => void) => {
      listeners.set(name, callback);
      return () => listeners.delete(name);
    },
  };
  await act(async () => {
    tree = create(
      <NavigationContext.Provider value={navigation as any}>
        <Screen />
      </NavigationContext.Provider>,
    );
  });
  await Promise.all([event, event, event].map((value) => feedbackCoordinator.publish(value)));
  await feedbackCoordinator.flush();
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  expect(toast).not.toHaveBeenCalled();
  expect(notification).not.toHaveBeenCalled();
  listeners.get('blur')!();
  await feedbackCoordinator.publish({ ...event, entity: { type: 'receipt', id: 'late-receipt' } });
  await feedbackCoordinator.flush();
  expect(toast).toHaveBeenCalledTimes(1);
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(2);
  listeners.get('focus')!();
  await feedbackCoordinator.publish(event);
  await feedbackCoordinator.flush();
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(2);
  disconnect();
});
