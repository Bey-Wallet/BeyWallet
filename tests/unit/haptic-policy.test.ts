import { HapticPolicy, type HapticState } from '~/services/feedback/hapticPolicy';

const active = (): HapticState => ({
  ready: true,
  enabled: true,
  foreground: true,
  unlocked: true,
  reducedMotion: false,
});

it.each(['ready', 'enabled', 'foreground', 'unlocked'] as const)(
  'discards all feedback when %s is false',
  (field) => {
    const state = { ...active(), [field]: false };
    const play = jest.fn();
    const policy = new HapticPolicy(() => state, play);
    policy.emit('selection');
    policy.emit('completion');
    state[field] = true;
    expect(play).not.toHaveBeenCalled();
    policy.emit('completion');
    expect(play).toHaveBeenCalledTimes(1);
  },
);

it('drops rapid ticks without delaying a completion or review', () => {
  let time = 0;
  const play = jest.fn();
  const policy = new HapticPolicy(active, play, () => time);
  policy.emit('keypad');
  time = 59;
  policy.emit('keypad');
  time = 60;
  policy.emit('keypad');
  policy.emit('selection');
  policy.emit('completion');
  policy.emit('review');
  time = 160;
  policy.emit('selection');
  expect(play.mock.calls.flat()).toEqual(['keypad', 'keypad', 'completion', 'review', 'selection']);
});

it('reduces optional feedback while preserving meaningful outcomes', () => {
  const play = jest.fn();
  const policy = new HapticPolicy(() => ({ ...active(), reducedMotion: true }), play);
  policy.emit('keypad');
  policy.emit('selection');
  policy.emit('acknowledge');
  policy.emit('completion');
  policy.emit('review');
  expect(play.mock.calls.flat()).toEqual(['completion', 'review']);
});

it('absorbs synchronous native errors and rejected native promises', async () => {
  const play = jest
    .fn()
    .mockImplementationOnce(() => {
      throw new Error('Unavailable');
    })
    .mockRejectedValueOnce(new Error('Disabled'));
  const policy = new HapticPolicy(active, play);
  expect(() => policy.emit('completion')).not.toThrow();
  policy.emit('reject');
  await Promise.resolve();
});
