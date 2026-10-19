import { usePreventRemove } from '@react-navigation/native';

/** Keep an in-flight wallet operation mounted until its result is known. */
export function useSettingsBusy(busy: boolean) {
  usePreventRemove(busy, () => {});
}
