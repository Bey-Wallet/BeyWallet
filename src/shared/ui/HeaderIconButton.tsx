import React, { forwardRef } from 'react';
import { AppIconButton, type AppIconButtonProps } from '~/shared/ui/AppIconButton';

type HeaderIconButtonProps = Omit<
  AppIconButtonProps,
  'variant' | 'emphasis' | 'size' | 'shape' | 'iconSize'
>;

/** Shared navigation chrome; retain screen-specific actions and disabled states. */
export const HeaderIconButton = forwardRef<
  React.ComponentRef<typeof AppIconButton>,
  HeaderIconButtonProps
>(function HeaderIconButton(props, ref) {
  return (
    <AppIconButton
      {...props}
      ref={ref}
      variant="default"
      emphasis="tertiary"
      size="xsmall"
      shape="circular"
      iconSize={22}
    />
  );
});
