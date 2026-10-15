import React, { act } from 'react';
import { Popover, TamaguiProvider, Text } from 'tamagui';
import { AppButton } from '~/shared/ui/AppButton';
import { AppIconButton } from '~/shared/ui/AppIconButton';
import { AppPressable } from '~/shared/ui/AppPressable';
import { config } from '~/tamagui.config';

const { createRoot } = require('react-dom/client') as {
  createRoot: (element: HTMLElement) => {
    render: (node: React.ReactNode) => void;
    unmount: () => void;
  };
};
jest.mock('~/shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('~/shared/ui/Spinner', () => ({ Spinner: () => null }));

it('renders native keyboard-accessible controls and suppresses disabled interaction', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onPress = jest.fn();
  const render = (disabled: boolean) => (
    <TamaguiProvider config={config} defaultTheme="light">
      <AppPressable
        accessibilityLabel="Choose mint"
        accessibilityState={{ selected: true, expanded: false }}
        minHeight={36}
        disabled={disabled}
        onPress={onPress}
      >
        <Text>Mint</Text>
      </AppPressable>
    </TamaguiProvider>
  );
  await act(async () => root.render(render(false)));
  const control = container.querySelector('[aria-label="Choose mint"]') as HTMLElement;
  expect(control.getAttribute('role')).toBe('button');
  expect(control.tagName).toBe('BUTTON');
  expect(control.getAttribute('aria-selected')).toBe('true');
  await act(async () => {
    control.focus();
    control.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    control.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    // JSDOM does not synthesize the click that a browser emits for a native button.
    control.click();
  });
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(control.style.outlineWidth).toBe('2px');
  expect(control.style.outlineOffset).toBe('2px');
  await act(async () => root.render(render(true)));
  await act(async () => control.click());
  expect(onPress).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
  container.remove();
});

it('retains native link semantics and forwards refs for slotted action controls', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const ref = React.createRef<React.ElementRef<typeof AppButton>>();
  const onPress = jest.fn((event) => event.preventDefault());
  await act(async () =>
    root.render(
      <TamaguiProvider config={config} defaultTheme="dark">
        <AppButton
          ref={ref}
          variant="default"
          emphasis="primary"
          role="link"
          href="/"
          onPress={onPress}
        >
          Go to Home
        </AppButton>
      </TamaguiProvider>,
    ),
  );
  const link = container.querySelector('a')!;
  expect(link.getAttribute('href')).toBe('/');
  expect(ref.current === link).toBe(true);
  await act(async () => link.click());
  expect(onPress).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
  container.remove();
});

it('opens a popover through an AppButton trigger and keeps its expanded state', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onOpenChange = jest.fn();
  await act(async () =>
    root.render(
      <TamaguiProvider config={config} defaultTheme="light">
        <Popover onOpenChange={onOpenChange}>
          <Popover.Trigger asChild>
            <AppIconButton
              variant="default"
              emphasis="tertiary"
              icon={() => null}
              accessibilityLabel="More options"
            />
          </Popover.Trigger>
        </Popover>
      </TamaguiProvider>,
    ),
  );
  const trigger = container.querySelector('button')!;
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  await act(async () => trigger.click());
  expect(onOpenChange.mock.calls[0][0]).toBe(true);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  await act(async () => root.unmount());
  container.remove();
});

it.each(['light', 'dark'])(
  'forwards icon link refs and exposes busy state in the %s theme',
  async (theme) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const ref = React.createRef<React.ComponentRef<typeof AppIconButton>>();
    const onPress = jest.fn((event) => event.preventDefault());
    const render = (loading: boolean) => (
      <TamaguiProvider config={config} defaultTheme={theme}>
        <AppIconButton
          ref={ref}
          variant="default"
          role="link"
          href="/"
          icon={() => null}
          accessibilityLabel="Open wallet"
          loading={loading}
          onPress={onPress}
        />
      </TamaguiProvider>
    );
    await act(async () => root.render(render(false)));
    const link = container.querySelector('a')!;
    expect(ref.current).toBe(link);
    expect(link.getAttribute('aria-label')).toBe('Open wallet');
    expect(link.getAttribute('href')).toBe('/');
    await act(async () => {
      link.focus();
      link.click();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(link);
    await act(async () => root.render(render(true)));
    expect(link.getAttribute('aria-busy')).toBe('true');
    expect(link.getAttribute('aria-disabled')).toBe('true');
    await act(async () => link.click());
    expect(onPress).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
    container.remove();
  },
);
