import React from 'react'
import type { Insets } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GetProps, SizeTokens, styled, View } from 'tamagui'

export const flexStyles = {
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
  shrink: { flexShrink: 1 },
}

type SizeOrNumber = number | SizeTokens

type SizedInset = {
  top: SizeOrNumber
  left: SizeOrNumber
  right: SizeOrNumber
  bottom: SizeOrNumber
}

const getInset = (val: SizeOrNumber): SizedInset => ({
  top: val,
  right: val,
  bottom: val,
  left: val,
})

export const Flex = styled(View, {
  flexDirection: 'column',

  variants: {
    inset: (size: SizeOrNumber | Insets) => (size && typeof size === 'object' ? size : getInset(size as SizeOrNumber)),

    row: {
      true: {
        flexDirection: 'row',
      },
      false: {
        flexDirection: 'column',
      },
    },

    shrink: {
      true: {
        flexShrink: 1,
      },
    },

    grow: {
      true: {
        flexGrow: 1,
      },
    },

    fill: {
      true: {
        flex: 1,
      },
    },

    centered: {
      true: {
        alignItems: 'center',
        justifyContent: 'center',
      },
    },
  } as const,
})

Flex.displayName = 'Flex'

export type FlexProps = GetProps<typeof Flex>

export interface InsetProps {
  /** applies consistent padding to each side */
  all?: SizeOrNumber
  children: React.ReactNode
}

/**
 * Spacing component that indents content on all four sides
 */
export function Inset({ all = '$4', children }: InsetProps): JSX.Element {
  return <Flex p={all}>{children}</Flex>
}

export interface SafeFlexProps extends FlexProps {
  edges?: ('top' | 'bottom' | 'left' | 'right')[]
}

/**
 * A Flex layout container that automatically respects safe area insets on specified edges by default.
 */
export function SafeFlex({
  edges = ['top', 'bottom'],
  children,
  ...props
}: SafeFlexProps): JSX.Element {
  const insets = useSafeAreaInsets()

 
  const paddingBottom = edges.includes('bottom') ? insets.bottom : 0
  const paddingLeft = edges.includes('left') ? insets.left : 0
  const paddingRight = edges.includes('right') ? insets.right : 0

  return (
    <Flex
   
      pb={paddingBottom || undefined}
      pl={paddingLeft || undefined}
      pr={paddingRight || undefined}
      {...props}
    >
      {children}
    </Flex>
  )
}
