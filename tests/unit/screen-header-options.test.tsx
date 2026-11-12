import React, { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { useScreenHeaderOptions } from '~/shared/ui/useScreenHeaderOptions';

jest.mock('tamagui', () => ({
  useTheme: () => ({ background: { val: '#000' }, color: { val: '#fff' } }),
}));
jest.mock('~/shared/ui/BUI/BUIHeader', () => ({ BUIHeader: 'Header' }));
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const Insets = React.createContext({ top: 24, bottom: 0, left: 0, right: 0 });
  return { useSafeAreaInsets: () => React.useContext(Insets) };
});

/** Native stack invokes the optional header as a callback inside SceneView. */
function Scene({ showHeader }: { showHeader: boolean }) {
  const options = useScreenHeaderOptions();
  const header = showHeader
    ? options.header({
        options: { title: 'Wallet', headerRight: () => <React.Fragment>Help</React.Fragment> },
        route: { key: 'wallet', name: 'wallet' },
        navigation: {} as NativeStackHeaderProps['navigation'],
      })
    : null;
  const [body] = useState('Wallet content');
  return (
    <>
      {header}
      {body}
    </>
  );
}

it('mounts and removes a native-stack header without changing the scene hook order', async () => {
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(<Scene showHeader={false} />);
    });
    await act(async () => tree!.update(<Scene showHeader />));
    expect(tree!.root.findByType('Header' as any).props).toMatchObject({
      title: 'Wallet',
      topInset: 24,
    });
    await act(async () => tree!.update(<Scene showHeader={false} />));
    await act(async () => tree!.update(<Scene showHeader />));
    expect(errors).not.toHaveBeenCalled();
  } finally {
    if (tree) await act(async () => tree!.unmount());
    errors.mockRestore();
  }
});
