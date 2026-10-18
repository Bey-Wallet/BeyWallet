import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { RemoteImage, MintImage } from '~/shared/ui/RemoteImage';

jest.mock('tamagui', () => ({ Text: 'Text', View: 'View' }));
jest.mock('@tamagui/lucide-icons', () => ({ Sprout: 'Sprout' }));
jest.mock('react-native-fast-image', () => ({
  __esModule: true,
  default: Object.assign((props: any) => require('react').createElement('FastImage', props), {
    cacheControl: { web: 'web' },
  }),
}));

it('uses HTTP caching and resets profile errors when URL or identity changes', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <RemoteImage
        identity="alice"
        src="https://images.example/profile"
        width={40}
        height={40}
        fallback={<span>avatar</span>}
      />,
    );
  });
  const image = () => tree.root.findByType('FastImage' as any);
  expect(image().props.source.cache).toBe('web');
  await act(async () => image().props.onError());
  expect(tree.root.findAllByType('FastImage' as any)).toHaveLength(0);
  await act(async () => {
    tree.update(
      <RemoteImage identity="bob" src="https://images.example/profile" width={40} height={40} />,
    );
  });
  expect(image().props.source.uri).toBe('https://images.example/profile');
  await act(async () => tree.unmount());
});
it('falls back from mint icon to favicon to placeholder and resets for another mint', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <MintImage
        mintUrl="https://mint.example/path"
        src="https://cdn.example/icon"
        width={40}
        height={40}
      />,
    );
  });
  const image = () => tree.root.findByType('FastImage' as any);
  await act(async () => image().props.onError());
  expect(image().props.source.uri).toBe('https://mint.example/favicon.ico');
  await act(async () => image().props.onError());
  expect(tree.root.findAllByType('Sprout' as any)).toHaveLength(1);
  await act(async () => {
    tree.update(
      <MintImage
        mintUrl="https://other.example"
        src="https://cdn.example/icon"
        width={40}
        height={40}
      />,
    );
  });
  expect(image().props.source.uri).toBe('https://cdn.example/icon');
  await act(async () => tree.unmount());
});
