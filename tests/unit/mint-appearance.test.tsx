import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'tamagui';
import { MintAppearance } from '~/features/mints/components/MintUI';
import { MintTrustContent } from '~/features/mints/components/MintTrustContent';
import { useBUITheme } from '~/shared/ui/BUI/useBUITheme';
import { getBUITheme } from '~/shared/ui/BUI/theme';
import { useBUIStore } from '~/state/buiStore';

let mockThemeName = 'light';
jest.mock('tamagui', () => ({
  Theme: 'Theme',
  Text: 'Text',
  XStack: 'XStack',
  YStack: 'YStack',
  Separator: 'Separator',
  useThemeName: () => mockThemeName,
}));
jest.mock('~/shared/ui/AppButton', () => ({ AppButton: 'Button' }));

function Probe({ id }: { id: string }) {
  const theme = useBUITheme();
  return <Text testID={id} color={theme.text} />;
}

it.each(['light', 'dark'] as const)(
  'scopes mint content to the active %s appearance without changing other BUI content',
  async (appearance) => {
    mockThemeName = appearance;
    const catalogAppearance = appearance === 'light' ? 'dark' : 'light';
    useBUIStore.setState({ appearance: catalogAppearance });
    let tree!: ReactTestRenderer;
    try {
      await act(async () => {
        tree = create(
          <>
            <Probe id="outside" />
            <MintAppearance>
              <Probe id="mint" />
            </MintAppearance>
            <Probe id="after" />
          </>,
        );
      });
      expect(tree.root.findByProps({ testID: 'mint' }).props.color).toBe(
        getBUITheme(appearance).text,
      );
      for (const id of ['outside', 'after']) {
        expect(tree.root.findByProps({ testID: id }).props.color).toBe(
          getBUITheme(catalogAppearance).text,
        );
      }
      expect(useBUIStore.getState().appearance).toBe(catalogAppearance);
    } finally {
      if (tree) await act(async () => tree.unmount());
      useBUIStore.setState({ appearance: 'dark' });
    }
  },
);

it('keeps trust dialog content on the wallet theme when the catalog differs, and responds to a theme change', async () => {
  useBUIStore.setState({ appearance: 'dark' });
  mockThemeName = 'light';
  const content = () => (
    <MintTrustContent mints={[{ url: 'https://mint.example' }]} onConfirm={() => {}}>
      <Probe id="trust-theme" />
    </MintTrustContent>
  );
  let tree!: ReactTestRenderer;
  try {
    await act(async () => {
      tree = create(content());
    });
    expect(tree.root.findByProps({ testID: 'trust-theme' }).props.color).toBe(
      getBUITheme('light').text,
    );
    mockThemeName = 'dark';
    await act(async () => tree.update(content()));
    expect(tree.root.findByProps({ testID: 'trust-theme' }).props.color).toBe(
      getBUITheme('dark').text,
    );
    expect(useBUIStore.getState().appearance).toBe('dark');
  } finally {
    await act(async () => tree?.unmount());
  }
});
