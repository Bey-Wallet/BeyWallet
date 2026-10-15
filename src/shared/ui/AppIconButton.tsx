import React, { forwardRef } from 'react';
import { AppButton, type AppButtonProps } from '~/shared/ui/AppButton';

export type AppIconButtonProps = Omit<
  Extract<AppButtonProps, { iconOnly: true }>,
  'iconOnly' | 'children' | 'iconAfter' | 'density'
> & { children?: never; iconAfter?: never };

export const AppIconButton = forwardRef<React.ComponentRef<typeof AppButton>, AppIconButtonProps>(
  function AppIconButton(props, ref) {
    return <AppButton {...props} ref={ref} iconOnly density="compact" />;
  },
);
