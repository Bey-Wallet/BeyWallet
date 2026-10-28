import * as Clipboard from 'expo-clipboard';
import { interactionCopy } from '~/services/feedback/interactionCopy';

/** Return before success UI when the native clipboard fails. Never log clipboard contents. */
export async function copyWithFeedback(
  text: string,
  feedback: { show: (title: string, options: { kind: 'error' }) => unknown },
): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    feedback.show(interactionCopy.copyFailed.title, { kind: 'error' });
    return false;
  }
}
