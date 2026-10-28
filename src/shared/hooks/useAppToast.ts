import { useToastController } from '@tamagui/toast';
import { useMemo } from 'react';
import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { interactionCopy } from '~/services/feedback/interactionCopy';
import {
  interactionToastOptions,
  type InteractionNotice,
} from '~/services/feedback/interactionPresentation';

/** Shared presentation policy for user-triggered utility feedback. */
export function useAppToast() {
  const controller = useToastController();
  return useMemo(() => {
    const showFeedback = (notice: InteractionNotice) =>
      controller.show(notice.title, interactionToastOptions(notice));
    const copy = async (text: string): Promise<boolean> => {
      try {
        const copied = await Clipboard.setStringAsync(text);
        if (copied === false) throw new Error('Clipboard write failed');
        showFeedback(interactionCopy.copiedToClipboard);
        return true;
      } catch {
        showFeedback(interactionCopy.copyFailed);
        return false;
      }
    };
    const openExternal = async (url: string): Promise<boolean> => {
      try {
        await Linking.openURL(url);
        return true;
      } catch {
        showFeedback(interactionCopy.linkFailed);
        return false;
      }
    };
    return { ...controller, showFeedback, copy, openExternal };
  }, [controller]);
}
