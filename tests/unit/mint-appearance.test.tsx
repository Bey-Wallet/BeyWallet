import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'tamagui';
import { MintAppearance } from '~/features/mints/components/MintUI';
import { useBUITheme } from '~/shared/ui/BUI/useBUITheme';
import { getBUITheme } from '~/shared/ui/BUI/theme';
import { useBUIStore } from '~/state/buiStore';

let mockThemeName = 'light';
jest.mock('tamagui', () => ({
  Theme: 'Theme',
  Text: 'Text',
  useThemeName: () => mockThemeName,
}));

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
