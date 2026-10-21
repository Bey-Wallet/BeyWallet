import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import {
  TamaguiProvider,
  Text,
  SizableText,
  Paragraph,
  Heading,
  H1,
  H2,
  H3,
  H4,
  H5,
  H6,
  Label,
  Input,
  TextArea,
} from 'tamagui';
import { Toast } from '@tamagui/toast';
import { config } from '~/tamagui.config';
import { AppButton } from '~/shared/ui/AppButton';

jest.mock('~/shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: () => null }));

it.each([
  ['400', 'SpecialGothicRegular'],
  ['500', 'SpecialGothicMedium'],
  ['600', 'SpecialGothicSemiBold'],
  ['700', 'SpecialGothicSemiBold'],
] as const)('renders body and heading weight %s with %s', async (weight, family) => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <TamaguiProvider config={config} defaultTheme="light">
        <Text testID="body-font" fontWeight={weight}>
          Bey 123
        </Text>
        <Heading testID="heading-font" fontWeight={weight}>
          Bey 123
        </Heading>
      </TamaguiProvider>,
    );
  });
  for (const id of ['body-font', 'heading-font']) {
    const families = tree.root
      .findAll((node) => node.props.testID === id)
      .map((node) => StyleSheet.flatten(node.props.style)?.fontFamily);
    expect(families).toContain(family);
  }
  await act(async () => tree.unmount());
});

it('applies tabular numerals to rendered text variants, inputs, toast titles, and button labels', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <TamaguiProvider config={config} defaultTheme="light">
        <Text testID="text">123</Text>
        <SizableText testID="sizable">123</SizableText>
        <Paragraph testID="paragraph">123</Paragraph>
        <Heading testID="heading">123</Heading>
        <H1 testID="h1">123</H1>
        <H2 testID="h2">123</H2>
        <H3 testID="h3">123</H3>
        <H4 testID="h4">123</H4>
        <H5 testID="h5">123</H5>
        <H6 testID="h6">123</H6>
        <Label testID="label">123</Label>
        <Input testID="input" value="123" />
        <TextArea testID="textarea" value="123" />
        <Toast.Title testID="toast">123</Toast.Title>
        <AppButton>Pay 123 sat</AppButton>
        <Text testID="override" fontVariant={['proportional-nums']}>
          123
        </Text>
      </TamaguiProvider>,
    );
  });
  for (const id of [
    'text',
    'sizable',
    'paragraph',
    'heading',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'label',
    'input',
    'textarea',
    'toast',
  ]) {
    const renderedStyles = tree.root
      .findAll((n) => n.props.testID === id)
      .map((n) => StyleSheet.flatten(n.props.style));
    const styles = renderedStyles.map((style) => style?.fontVariant);
    expect({ id, styles }).toEqual({ id, styles: expect.arrayContaining([['tabular-nums']]) });
    expect({
      id,
      usesSpecialGothic: renderedStyles.some((style) =>
        style?.fontFamily?.startsWith('SpecialGothic'),
      ),
    }).toEqual({ id, usesSpecialGothic: true });
  }
  const buttonLabels = tree.root.findAll((n) => n.props.children === 'Pay 123 sat');
  expect(
    buttonLabels.some((n) =>
      StyleSheet.flatten(n.props.style)?.fontVariant?.includes('tabular-nums'),
    ),
  ).toBe(true);
  const overrides = tree.root
    .findAll((n) => n.props.testID === 'override')
    .map((n) => StyleSheet.flatten(n.props.style)?.fontVariant);
  expect(overrides).toContainEqual(['proportional-nums']);
  await act(async () => tree.unmount());
});
