import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import React, { useCallback, useLayoutEffect, useState } from 'react';
import { Keyboard } from 'react-native';
import { useNavigation } from 'expo-router';
import { Text, XStack } from 'tamagui';
import { appDimensions, appSpacing } from '~/shared/theme/appearance';
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
      headerTitle: () => (
        <Text
          fontFamily="$heading"
          fontWeight="600"
          fontSize="$7"
          color="$color"
          accessibilityRole="header"
        >
          History
        </Text>
      ),
      headerRight: () => (
        <XStack height={appDimensions.touchTarget} pr={appSpacing.page} items="center">
          <XStack
            width={appDimensions.touchTarget}
            height={appDimensions.touchTarget}
            items="center"
            justify="center"
          >
            <HeaderIconButton
              accessibilityLabel={showSearch ? 'Close history search' : 'Search history'}
              accessibilityState={{ expanded: showSearch }}
              icon={showSearch ? X : Search}
              onPress={toggleSearch}
            />
          </XStack>
          <XStack
            width={appDimensions.touchTarget}
            height={appDimensions.touchTarget}
            items="center"
            justify="center"
          >
            <HeaderIconButton
              accessibilityState={{ selected: filterHighlighted }}
              accessibilityLabel="Filter history"
              icon={SlidersHorizontal}
              onPress={toggleFilters}
            />
          </XStack>
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
