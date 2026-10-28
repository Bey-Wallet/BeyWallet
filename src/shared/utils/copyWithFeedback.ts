import * as Clipboard from 'expo-clipboard';
import { interactionCopy } from '~/services/feedback/interactionCopy';

/** Return before success UI when the native clipboard fails. Never log clipboard contents. */
export async function copyWithFeedback(
  text: string,
  feedback: { show: (title: string, options: { kind: 'error'; duration?: number }) => unknown },
): Promise<boolean> {
  try {
    const copied = await Clipboard.setStringAsync(text);
    if (copied === false) throw new Error('Clipboard write failed');
    return true;
  } catch {
    feedback.show(interactionCopy.copyFailed.title, { kind: 'error', duration: 4000 });
    return false;
  }
}
