import React, { act } from 'react';
import { TamaguiProvider, Theme } from 'tamagui';
import { config } from '~/tamagui.config';
import { BeyText } from '~/shared/ui/BeyText';

const { createRoot } = require('react-dom/client') as {
  createRoot: (element: HTMLElement) => {
    render: (node: React.ReactNode) => void;
    unmount: () => void;
  };
};

it('renders source OpenType features and real bundled font faces as browser CSS', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <TamaguiProvider config={config} defaultTheme="light">
          <Theme name="dark_bey">
            <BeyText variant="body1" testID="body">
              Simple payments 123
            </BeyText>
            <BeyText variant="h1" testID="heading">
              A clear heading
            </BeyText>
            <BeyText variant="label1" testID="label">
              Medium label
            </BeyText>
            <BeyText variant="mono" testID="mono">
              bey:demo:123
            </BeyText>
            <BeyText variant="body1" fontVariant={['tabular-nums']} testID="override">
              123
            </BeyText>
          </Theme>
        </TamaguiProvider>,
      ),
    );
    const style = (id: string) =>
      getComputedStyle(container.querySelector(`[data-testid="${id}"]`)!);
    expect(style('body').fontFamily).toContain('TTFirsNeueNormal');
    expect(style('body').fontFeatureSettings).toContain('ss07');
    expect(style('body').fontFeatureSettings).toContain('ss17');
    expect(style('body').fontVariant).not.toContain('stylistic-');
    expect(style('heading').fontFamily).toContain('TTFirsNeueDemiBold');
    expect(style('heading').fontFeatureSettings).toContain('ss09');
    expect(style('heading').fontFeatureSettings).not.toContain('ss07');
    expect(style('heading').getPropertyValue('font-synthesis')).toBe('none');
    expect(style('label').fontFamily).toContain('TTFirsNeueMedium');
    expect(style('mono').fontFamily).toContain('BeyRobotoMono');
    expect(style('override').fontVariant).toContain('tabular-nums');
    expect(style('override').fontFeatureSettings).toBe('normal');
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
