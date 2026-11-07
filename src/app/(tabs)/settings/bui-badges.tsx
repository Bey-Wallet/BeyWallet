import { createBUIDevRoute } from '~/features/settings/bui/BUIDevRoute';

export default createBUIDevRoute(
  () => require('~/features/settings/BUIBadgesScreen').BUIBadgesScreen,
);
