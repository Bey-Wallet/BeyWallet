import type { WalletActivity } from '~/storage/sqlite/repositories/WalletActivityRepository';
export function walletActivityTitle(activity: Pick<WalletActivity, 'kind' | 'state'>) {
  if (activity.kind === 'get-change')
    return activity.state === 'completed' ? 'Change prepared' : 'Get change';
  if (activity.kind === 'optimize')
    return activity.state === 'completed' ? 'Wallet optimized' : 'Wallet optimization';
  return 'Wallet recovery';
}
export function walletActivityStatus(state: WalletActivity['state']) {
  return state === 'completed'
    ? 'Completed'
    : state === 'canceled'
      ? 'Cancelled'
      : state === 'review'
        ? 'Needs review'
        : 'Outcome pending';
}
