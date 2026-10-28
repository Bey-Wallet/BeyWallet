import React, { forwardRef } from 'react';
import { Input, TextArea, type InputProps, type TextAreaProps } from 'tamagui';

/** Keep size variants from changing control corners. Explicit caller shapes still win. */
export const AppInput = forwardRef<React.ComponentRef<typeof Input>, InputProps>(function AppInput(
  { rounded, borderRadius, ...props },
  ref,
) {
  return <Input {...props} ref={ref} borderRadius={borderRadius ?? rounded ?? '$5'} />;
});

export const AppTextArea = forwardRef<React.ComponentRef<typeof TextArea>, TextAreaProps>(
  function AppTextArea({ rounded, borderRadius, ...props }, ref) {
    return <TextArea {...props} ref={ref} borderRadius={borderRadius ?? rounded ?? '$5'} />;
  },
);
