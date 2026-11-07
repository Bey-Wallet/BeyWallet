import React from 'react';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BUIHeader } from './BUI/BUIHeader';

/** Keep route-owned titles and actions inside the BUI header geometry. */
export function AppScreenHeader(props: NativeStackHeaderProps) {
  const { options, route } = props;
  const insets = useSafeAreaInsets();
  const canGoBack = 'back' in props && !!props.back;
  const title =
    typeof options.headerTitle === 'string' ? options.headerTitle : (options.title ?? route.name);
  const controlProps = { tintColor: options.headerTintColor, canGoBack };
  return (
    <BUIHeader
      title={title}
      variant="modal"
      topInset={insets.top}
      navigation="none"
      leading={options.headerLeft?.(controlProps)}
      actions={options.headerRight?.(controlProps)}
      titleContent={
        typeof options.headerTitle === 'function'
          ? options.headerTitle({ children: title, tintColor: options.headerTintColor })
          : undefined
      }
    />
  );
}
