import { AppIconButton } from '~/shared/ui/AppIconButton';
import React, { useCallback, useLayoutEffect, useState } from 'react';
import { Keyboard } from 'react-native';
import { useNavigation } from 'expo-router';
import { Text, XStack } from 'tamagui';
import { AppPressable } from '~/shared/ui/AppPressable';
import type { HistoryScope } from './historyList';
import { SlidersHorizontal, Search, X } from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { HistoryScreen } from './index';

export function HistoryTabScreen() {
  const navigation = useNavigation();
  const [scope, setScope] = useState<HistoryScope>('wallet');
  const [showFilters, setShowFilters] = useState(false);
  const [filtersActive, setFiltersActive] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const filterHighlighted = showFilters || filtersActive;
  const closeFilters = useCallback(() => setShowFilters(false), []);
  const closeSearch = useCallback(() => {
    Keyboard.dismiss();
    setShowSearch(false);
  }, []);
  const toggleFilters = useCallback(() => {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowFilters((visible) => !visible);
  }, []);
  const toggleSearch = useCallback(() => {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowSearch((visible) => !visible);
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <XStack items="center" gap="$2">
          <Text fontWeight="600" fontSize="$7" color="$color">
            History
          </Text>
          <AppPressable
            minHeight={48}
            minWidth={48}
            items="center"
            justify="center"
            bg="transparent"
            opacity={scope === 'pos' ? 1 : 0.4}
            hoverStyle={{ bg: 'transparent', opacity: scope === 'pos' ? 0.85 : 0.6 }}
            pressStyle={{ bg: 'transparent', opacity: 0.6 }}
            accessibilityLabel="POS history"
            accessibilityState={{ selected: scope === 'pos' }}
            onPress={() => {
              Keyboard.dismiss();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowSearch(false);
              setShowFilters(false);
              setFiltersActive(false);
              setScope((current) => (current === 'wallet' ? 'pos' : 'wallet'));
            }}
          >
            <Text fontFamily="$body" fontSize={14} fontWeight="600" color="$color">
              POS
            </Text>
          </AppPressable>
        </XStack>
      ),
      headerRight: () => (
        <XStack pr="$4" gap="$2">
          <AppIconButton
            variant="default"
            emphasis={showSearch ? 'primary' : 'secondary'}
            size="small"
            shape="circular"
            iconSize={22}
            accessibilityLabel={showSearch ? 'Close history search' : 'Search history'}
            accessibilityState={{ expanded: showSearch }}
            icon={showSearch ? <X color="$onAccent" /> : <Search color="$iconPrimary" />}
            onPress={toggleSearch}
          />
          <AppIconButton
            variant="default"
            emphasis={filterHighlighted ? 'primary' : 'secondary'}
            size="small"
            shape="circular"
            iconSize={22}
            accessibilityLabel="Filter history"
            icon={
              <SlidersHorizontal
                strokeWidth={2}
                color={filterHighlighted ? '$onAccent' : '$iconPrimary'}
              />
            }
            onPress={toggleFilters}
          />
        </XStack>
      ),
    });
  }, [navigation, filterHighlighted, toggleFilters, showSearch, toggleSearch, scope]);

  return (
    <HistoryScreen
      key={scope}
      scope={scope}
      showFilters={showFilters}
      onFiltersClose={closeFilters}
      onFiltersActiveChange={setFiltersActive}
      showSearch={showSearch}
      onSearchClose={closeSearch}
    />
  );
}
