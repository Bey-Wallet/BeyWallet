import React, { useEffect, useId, useRef, useState } from 'react';
import { Animated, Image as NativeImage, PixelRatio, type ImageSourcePropType } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Image as SvgImage,
  Mask,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { YStack } from 'tamagui';
import { useReducedMotion } from '~/shared/hooks/useReducedMotion';
import { useBUITheme } from './useBUITheme';
import { buiBadgeOffset, type BUIBadgeDirection, type BUIBadgeStrategy } from './badgeGeometry';

export type BUIAvatarProps = {
  source?: ImageSourcePropType;
  size?: number;
  shape?: 'circle' | 'rounded';
  initials?: string;
  label: string;
  presentation?: 'auto' | 'loading' | 'error';
  cutout?: { x: number; y: number; radius: number };
};

export function BUIAvatar(props: BUIAvatarProps) {
  return <AvatarContent key={JSON.stringify(props.source ?? null)} {...props} />;
}

function AvatarContent({
  source,
  size = 36,
  shape = 'circle',
  initials = '',
  label,
  presentation = 'auto',
  cutout,
}: BUIAvatarProps) {
  const c = useBUITheme();
  const reducedMotion = useReducedMotion();
  const id = `buiAvatar${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const opacity = useRef(new Animated.Value(0)).current;
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  // The outer key remounts this component whenever source content changes.
  const imageSource = useRef(source).current;
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let active = true;
    setState('loading');
    opacity.setValue(0);
    if (presentation === 'error') setState('error');
    else if (presentation === 'auto' && !imageSource && initials.length > 0) setState('error');
    else if (presentation === 'auto' && imageSource) {
      if (typeof imageSource === 'number') setState('ready');
      else {
        const uri = NativeImage.resolveAssetSource(imageSource)?.uri;
        if (uri)
          NativeImage.getSize(
            uri,
            () => {
              if (active) setState('ready');
            },
            () => {
              if (active) setState('error');
            },
          );
        else setState('error');
      }
    }
    return () => {
      active = false;
      animation.current?.stop();
    };
  }, [imageSource, presentation, opacity, initials.length > 0]);
  useEffect(() => {
    if (reducedMotion) {
      animation.current?.stop();
      opacity.setValue(1);
    }
  }, [reducedMotion, opacity]);
  const visible = presentation === 'auto' ? state : presentation;
  const outlined = visible === 'error' && initials.length > 0;
  const radius = shape === 'circle' ? size / 2 : 12;
  const mask = (
    <Defs>
      <Mask id={id} x={0} y={0} width={size} height={size} maskUnits="userSpaceOnUse">
        <Rect width={size} height={size} rx={radius} fill="white" />
        {cutout && <Circle cx={cutout.x} cy={cutout.y} r={cutout.radius} fill="black" />}
      </Mask>
    </Defs>
  );
  const reveal = () => {
    animation.current?.stop();
    if (reducedMotion) opacity.setValue(1);
    else {
      animation.current = Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      });
      animation.current.start();
    }
  };
  return (
    <YStack width={size} height={size} accessible accessibilityLabel={label}>
      <Svg width={size} height={size} accessible={false}>
        {mask}
        <G mask={`url(#${id})`}>
          <Rect
            x={outlined ? 0.5 : 0}
            y={outlined ? 0.5 : 0}
            width={outlined ? size - 1 : size}
            height={outlined ? size - 1 : size}
            rx={outlined ? radius - 0.5 : radius}
            fill={outlined ? 'none' : c.raised}
            stroke={outlined ? c.pressed : 'none'}
            strokeWidth={1}
          />
          {outlined && (
            <SvgText
              x={size / 2}
              y={size / 2}
              dy="0.35em"
              fontFamily="InterTextMedium"
              fontSize={10}
              fill={c.pressed}
              textAnchor="middle"
            >
              {initials}
            </SvgText>
          )}
        </G>
      </Svg>
      {visible === 'ready' && source && (
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', width: size, height: size, opacity }}
        >
          <Svg width={size} height={size} accessible={false}>
            <Defs>
              <Mask
                id={`${id}Image`}
                x={0}
                y={0}
                width={size}
                height={size}
                maskUnits="userSpaceOnUse"
              >
                <Rect width={size} height={size} rx={radius} fill="white" />
                {cutout && <Circle cx={cutout.x} cy={cutout.y} r={cutout.radius} fill="black" />}
              </Mask>
            </Defs>
            <SvgImage
              href={source}
              width={size}
              height={size}
              preserveAspectRatio="xMidYMid slice"
              mask={`url(#${id}Image)`}
              onLoad={reveal}
            />
          </Svg>
        </Animated.View>
      )}
    </YStack>
  );
}

export function BUIBadgedAvatar({
  badge,
  direction = 'EndBottom',
  strategy = 'Circle',
  cutout = true,
  ...props
}: Omit<BUIAvatarProps, 'cutout'> & {
  badge?: React.ReactNode;
  direction?: BUIBadgeDirection;
  strategy?: BUIBadgeStrategy;
  cutout?: boolean;
}) {
  const size = props.size ?? 44;
  const [measured, setMeasured] = useState({ width: 20, height: 20 });
  const hasBadge =
    badge != null && badge !== false && badge !== '' && measured.width > 0 && measured.height > 0;
  const offset = buiBadgeOffset(
    strategy,
    direction,
    { width: size, height: size },
    measured,
    PixelRatio.get(),
  );
  const hole =
    hasBadge && cutout
      ? {
          x: offset.x + measured.width / 2,
          y: offset.y + measured.height / 2,
          radius: Math.max(measured.width, measured.height) / 2 + 2,
        }
      : undefined;
  return (
    <YStack width={size} height={size}>
      <BUIAvatar {...props} size={size} cutout={hole} />
      {badge != null && badge !== false && badge !== '' && (
        <YStack
          position="absolute"
          l={offset.x}
          t={offset.y}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setMeasured((previous) =>
              previous.width === width && previous.height === height ? previous : { width, height },
            );
          }}
        >
          {badge}
        </YStack>
      )}
    </YStack>
  );
}

export function BUIAvatarStack({
  avatars,
  size = 36,
  direction = 'EndOnTop',
}: {
  avatars: readonly Pick<BUIAvatarProps, 'source' | 'initials' | 'label'>[];
  size?: number;
  direction?: 'EndOnTop' | 'StartOnTop';
}) {
  if (avatars.length === 0) return null;
  const step = size - 4;
  return (
    <YStack width={step * (avatars.length - 1) + size} height={size}>
      {avatars.map((avatar, index) => {
        const neighbor = direction === 'EndOnTop' ? index + 1 : index - 1;
        const cutout =
          neighbor >= 0 && neighbor < avatars.length
            ? { x: (neighbor - index) * step + size / 2, y: size / 2, radius: size / 2 + 2 }
            : undefined;
        return (
          <YStack
            key={`${avatar.label}-${index}`}
            position="absolute"
            l={index * step}
            t={0}
            zIndex={direction === 'EndOnTop' ? index : avatars.length - index}
          >
            <BUIAvatar {...avatar} size={size} cutout={cutout} />
          </YStack>
        );
      })}
    </YStack>
  );
}
