import React, { useState } from 'react';
import { Animated, I18nManager, Modal } from 'react-native';
import { Check, MoreHorizontal } from '@tamagui/lucide-icons';
import { ScrollView, Theme, YStack } from 'tamagui';
import { AppPressable } from '~/shared/ui/AppPressable';
import { BUIText } from './BUIText';
import { BUIHeaderAction } from './BUIHeader';
import { useBUITheme } from './useBUITheme';
import { useBUIAnchoredPopup } from './useBUIAnchoredPopup';
import { buiSelectorPosition } from './selectorGeometry';

export type BUIActionMenuItem = {
  id: string;
  title: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
};

export function BUIActionMenu({
  label,
  items = [],
  selectedId,
  onAction,
  alignment = 'start',
  iconTrigger = false,
  headerTrigger = false,
  renderContent,
}: {
  label: string;
  items?: readonly BUIActionMenuItem[];
  selectedId?: string;
  onAction?: (id: string) => void;
  alignment?: 'start' | 'center';
  iconTrigger?: boolean;
  headerTrigger?: boolean;
  renderContent?: (dismiss: () => boolean) => React.ReactNode;
}) {
  const c = useBUITheme();
  const popup = useBUIAnchoredPopup('menu', !!items.length || !!renderContent);
  const [customHeight, setCustomHeight] = useState(96);
  const width = Math.max(0, Math.min(240, popup.window.width - 16));
  const height = Math.min(
    popup.window.height,
    renderContent ? customHeight : items.length * 48 + Math.max(0, items.length - 1) * 0.5,
  );
  const position = buiSelectorPosition(
    popup.anchor ?? { x: 0, y: 0, width: 0, height: 0 },
    popup.window,
    { width, height },
    alignment,
    I18nManager.isRTL,
  );
  return (
    <>
      {headerTrigger ? (
        <BUIHeaderAction
          ref={popup.trigger}
          label={label}
          accessibilityState={{ expanded: popup.expanded }}
          onPress={popup.open}
          onLongPress={popup.open}
        >
          <MoreHorizontal size={22} color={popup.expanded ? '$onAccent' : c.text} />
        </BUIHeaderAction>
      ) : (
        <AppPressable
          ref={popup.trigger}
          accessibilityLabel={label}
          accessibilityState={{ expanded: popup.expanded }}
          minHeight={48}
          minWidth={48}
          px={iconTrigger ? 0 : 16}
          py={8}
          rounded={16}
          bg={iconTrigger ? 'transparent' : c.secondaryButton[0]}
          flexDirection="row"
          items="center"
          justify="center"
          gap={8}
          onPress={popup.open}
          onLongPress={popup.open}
        >
          <MoreHorizontal size={iconTrigger ? 22 : 20} color={c.text} />
          {!iconTrigger && <BUIText kind="label2">{label}</BUIText>}
        </AppPressable>
      )}
      <Modal
        visible={!!popup.anchor}
        transparent
        statusBarTranslucent
        animationType="none"
        onRequestClose={popup.close}
      >
        <Theme name={popup.appearance === 'light' ? 'light_bui' : 'dark_bui'}>
          <YStack flex={1}>
            <AppPressable
              accessibilityLabel="Dismiss menu"
              children={null}
              position="absolute"
              t={0}
              b={0}
              l={0}
              r={0}
              onPress={popup.close}
            />
            {popup.anchor && (
              <Animated.View
                accessibilityViewIsModal
                pointerEvents={popup.expanded ? 'auto' : 'none'}
                style={{
                  position: 'absolute',
                  left: position.x,
                  top: position.y,
                  width,
                  maxHeight: height,
                  borderRadius: 20,
                  backgroundColor: c.raised,
                  overflow: 'hidden',
                  opacity: popup.alpha,
                  transformOrigin: [position.originX, position.originY, 0],
                  transform: [{ scale: popup.scale }],
                }}
              >
                <ScrollView
                  bounces={false}
                  onContentSizeChange={
                    renderContent ? (_, measured) => setCustomHeight(measured) : undefined
                  }
                >
                  {renderContent
                    ? renderContent(popup.close)
                    : items.map((item, index) => (
                        <YStack key={item.id}>
                          <AppPressable
                            accessibilityLabel={item.title}
                            accessibilityRole={selectedId === undefined ? 'button' : 'radio'}
                            accessibilityState={{
                              disabled: !!item.disabled,
                              ...(selectedId === undefined
                                ? {}
                                : { checked: selectedId === item.id }),
                            }}
                            disabled={item.disabled}
                            height={48}
                            minHeight={48}
                            px={16}
                            gap={8}
                            flexDirection="row"
                            items="center"
                            opacity={item.disabled ? 0.48 : 1}
                            onPress={() => {
                              if (!item.disabled && popup.close()) onAction?.(item.id);
                            }}
                          >
                            <BUIText
                              kind="label1"
                              flex={1}
                              numberOfLines={1}
                              color={item.destructive ? c.negative : c.text}
                            >
                              {item.title}
                            </BUIText>
                            {selectedId === item.id ? (
                              <Check size={16} color={c.primary} />
                            ) : (
                              item.icon
                            )}
                          </AppPressable>
                          {index < items.length - 1 && (
                            <YStack height={0.5} style={{ marginStart: 16 }} bg={c.separator} />
                          )}
                        </YStack>
                      ))}
                </ScrollView>
              </Animated.View>
            )}
          </YStack>
        </Theme>
      </Modal>
    </>
  );
}
