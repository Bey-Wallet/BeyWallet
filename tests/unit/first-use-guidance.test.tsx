import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { FirstUseGuidance } from '~/shared/ui/FirstUseGuidance';
import { useGuidanceStore, type GuidanceTopic } from '~/state/guidanceStore';
import { sqliteStorage } from '~/storage/sqlite/sqliteStorage';

jest.mock('~/storage/sqlite/sqliteStorage', () => ({
  sqliteStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('tamagui', () => ({ Text: 'Text', XStack: 'XStack', YStack: 'YStack' }));
jest.mock('~/shared/ui/AppIconButton', () => ({ AppIconButton: 'DismissButton' }));
jest.mock('@tamagui/lucide-icons', () => ({ X: 'X' }));

let tree: ReactTestRenderer;
beforeEach(() => {
  useGuidanceStore.setState({ dismissed: [] });
  jest.clearAllMocks();
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});

it.each(['recovery', 'offlineTokens', 'mintTrust'] as GuidanceTopic[])(
  'lets users skip %s without affecting other guidance and remembers the choice',
  async (topic) => {
    await act(async () => {
      tree = create(<FirstUseGuidance topic={topic} />);
    });
    expect(tree.root.findAllByType('Text' as any)).toHaveLength(2);
    await act(async () => tree.root.findByType('DismissButton' as any).props.onPress());
    expect(tree.toJSON()).toBeNull();
    expect(useGuidanceStore.getState().dismissed).toEqual([topic]);
    const saved = jest.mocked(sqliteStorage.setItem).mock.calls.at(-1)![1];
    await act(async () => {
      useGuidanceStore.setState({ dismissed: [] });
      jest.mocked(sqliteStorage.getItem).mockReturnValueOnce(saved);
      await useGuidanceStore.persist.rehydrate();
    });
    expect(useGuidanceStore.getState().dismissed).toEqual([topic]);
    expect(tree.toJSON()).toBeNull();
  },
);
