import { AppIconButton } from '~/shared/ui/AppIconButton';
import React, { useCallback, useLayoutEffect, useState } from 'react';
import { Keyboard } from 'react-native';
import { useNavigation } from 'expo-router';
import { XStack } from 'tamagui';
import { SlidersHorizontal, Search, X } from '@tamagui/lucide-icons';
import * as Haptics from 'expo-haptics';
import { HistoryScreen } from './index';

export function HistoryTabScreen() {
  const navigation = useNavigation();
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
  }, [navigation, filterHighlighted, toggleFilters, showSearch, toggleSearch]);

  return (
    <HistoryScreen
      showFilters={showFilters}
      onFiltersClose={closeFilters}
      onFiltersActiveChange={setFiltersActive}
      showSearch={showSearch}
      onSearchClose={closeSearch}
    />
  );
}
