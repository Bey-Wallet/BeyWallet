import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Svg, { Path } from 'react-native-svg';
import * as icons from '~/shared/icons';

let mockTheme = {
  color: { val: '#ffffff' },
  gray10: { val: '#aaaaaa' },
  onAccent: { val: '#000000' },
};
jest.mock('tamagui', () => ({
  useTheme: () => mockTheme,
  getTokens: () => ({ size: { $2: { val: 24 } } }),
}));

it('renders every mapped icon with real Phosphor artwork and the requested dimensions', async () => {
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(
        <>
          {Object.entries(icons).map(([name, Icon]) => (
            <Icon key={name} size={22} />
          ))}
        </>,
      );
    });
    const artwork = tree!.root.findAllByType(Svg);
    expect(artwork).toHaveLength(Object.keys(icons).length);
    for (const icon of artwork) {
      expect(icon.props.width).toBe(22);
      expect(icon.props.height).toBe(22);
      expect(icon.props.color).toBe('#ffffff');
      expect(icon.props.testID).toMatch(/^phosphor-react-native-.+-bold$/);
      expect(icon.findAllByType(Path).length).toBeGreaterThan(0);
    }
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

it('resolves theme tokens on appearance changes and preserves native accessibility', async () => {
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(
        <icons.Landmark color="$gray10" size="$2" accessibilityLabel="Receiving mint" />,
      );
    });
    expect(tree!.root.findByType(Svg).props).toMatchObject({
      color: '#aaaaaa',
      width: 24,
      height: 24,
      accessibilityLabel: 'Receiving mint',
    });
    mockTheme = {
      color: { val: '#111111' },
      gray10: { val: '#555555' },
      onAccent: { val: '#ffffff' },
    };
    await act(async () => {
      tree!.update(
        <icons.Landmark color="$gray10" size={22} accessibilityLabel="Receiving mint" />,
      );
    });
    expect(tree!.root.findByType(Svg).props.color).toBe('#555555');
    await act(async () => tree!.update(<icons.Landmark color="#123456" />));
    expect(tree!.root.findByType(Svg).props.color).toBe('#123456');
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});

it('uses bold by default, preserves fill states, and accepts explicit weight overrides', async () => {
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(
        <>
          <icons.Clock weight="fill" />
          <icons.Circle fill="#00ff00" />
          <icons.Scan strokeWidth={3} />
          <icons.Scan strokeWidth={2.5} />
          <icons.Scan weight="regular" />
          <icons.Nfc strokeWidth={3} />
          <icons.Nfc weight="fill" />
        </>,
      );
    });
    expect(tree!.root.findAllByType(Svg).map((icon) => icon.props.testID)).toEqual([
      'phosphor-react-native-clock-fill',
      'phosphor-react-native-circle-fill',
      'phosphor-react-native-scan-bold',
      'phosphor-react-native-scan-bold',
      'phosphor-react-native-scan-regular',
      'phosphor-react-native-contactless-payment-bold',
      'phosphor-react-native-contactless-payment-fill',
    ]);
  } finally {
    if (tree) await act(async () => tree!.unmount());
  }
});
