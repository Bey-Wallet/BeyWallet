import React, { forwardRef } from 'react';
import { AppIconButton, type AppIconButtonProps } from '~/shared/ui/AppIconButton';
import { appIconSizes } from '~/shared/theme/appearance';

type HeaderIconButtonProps = Omit<
  AppIconButtonProps,
  'variant' | 'emphasis' | 'size' | 'shape' | 'iconSize'
>;

/** BUI header actions: 32-point neutral circles, 22-point glyphs and a 48-point touch area. */
export const HeaderIconButton = forwardRef<
  React.ComponentRef<typeof AppIconButton>,
  HeaderIconButtonProps
>(function HeaderIconButton(props, ref) {
  return (
    <AppIconButton
      {...props}
      ref={ref}
      variant="default"
      emphasis={
        props.accessibilityState?.selected || props.accessibilityState?.expanded
          ? 'primary'
          : 'secondary'
      }
      size="xxsmall"
      shape="circular"
      iconSize={appIconSizes.header}
    />
  );
});
