import { HeaderIconButton } from '~/shared/ui/HeaderIconButton';
import { BUIHeaderAction } from '~/shared/ui/BUI/BUIHeader';
import React, { useCallback, useLayoutEffect, useState } from 'react';
import { Keyboard } from 'react-native';
import { useNavigation } from 'expo-router';
import { Text, XStack } from 'tamagui';
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
          <BUIHeaderAction
            label="POS history"
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
            <Text
              fontFamily="$body"
              fontSize={13}
              fontWeight="600"
              color={scope === 'pos' ? '$buttonDefaultPrimaryText' : '$buttonDefaultSecondaryText'}
            >
              POS
            </Text>
          </BUIHeaderAction>
        </XStack>
      ),
      headerRight: () => (
        <XStack gap={16}>
          <HeaderIconButton
            accessibilityLabel={showSearch ? 'Close history search' : 'Search history'}
            accessibilityState={{ expanded: showSearch }}
            icon={showSearch ? <X color="$onAccent" /> : <Search color="$iconPrimary" />}
            onPress={toggleSearch}
          />
          <HeaderIconButton
            accessibilityState={{ selected: filterHighlighted }}
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
