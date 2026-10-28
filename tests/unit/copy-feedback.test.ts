import * as Clipboard from 'expo-clipboard';
import { copyWithFeedback } from '~/shared/utils/copyWithFeedback';
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

it('allows success feedback only after the clipboard resolves', async () => {
  const feedback = { show: jest.fn() };
  (Clipboard.setStringAsync as jest.Mock).mockResolvedValue(undefined);
  expect(await copyWithFeedback('private-content', feedback)).toBe(true);
  expect(feedback.show).not.toHaveBeenCalled();
});

it('reports native copy failure once without displaying the copied data or exception', async () => {
  const feedback = { show: jest.fn() };
  (Clipboard.setStringAsync as jest.Mock).mockRejectedValue(
    new Error('native error: private-content'),
  );
  expect(await copyWithFeedback('private-content', feedback)).toBe(false);
  expect(feedback.show).toHaveBeenCalledTimes(1);
  expect(feedback.show).toHaveBeenCalledWith('Could not copy. Please try again.', {
    kind: 'error',
  });
});
