import {getAnalytics, logEvent, setUserProperty} from '@react-native-firebase/analytics';

let _fa = null;
const fa = () => { if (!_fa) _fa = getAnalytics(); return _fa; };

export const Analytics = {
  screen: (name) => logEvent(fa(), 'screen_view', {screen_name: name}),

  articleClicked: (title, position, source) => logEvent(fa(),'select_content', {content_type: 'article', item_id: title?.substring(0, 100) || '', position, ...(source ? {source} : {})}),
  articleShared: (title) => logEvent(fa(),'share', {content_type: 'article', item_id: title?.substring(0, 100) || ''}),
  articleScrollDepth: (title, depth) => logEvent(fa(),'article_scroll_depth', {item_name: title?.substring(0, 100), depth_percent: depth}),
  articleExternalLinkClicked: (title, url) => logEvent(fa(),'article_external_link_clicked', {item_name: title?.substring(0, 100), url: url?.substring(0, 100)}),

  trackDetailViewed: (round, venue) => logEvent(fa(),'track_detail_viewed', {round, venue}),
  raceClicked: (round, venue) => logEvent(fa(),'race_clicked', {round, venue}),
  liveTimingOpened: (venue) => logEvent(fa(),'live_timing_opened', {venue}),

  resultsYearChanged: (year) => logEvent(fa(),'results_year_changed', {year}),
  resultsTabChanged: (year, tab) => logEvent(fa(),'results_tab_changed', {year, tab}),
  roundResultsViewed: (year, round) => logEvent(fa(),'round_results_viewed', {year, round}),

  driverClicked: (name) => logEvent(fa(),'driver_clicked', {driver_name: name}),
  teamClicked: (name) => logEvent(fa(),'team_clicked', {team_name: name}),
  favouriteToggled: (name, added) => logEvent(fa(),'favourite_toggled', {driver_name: name, action: added ? 'added' : 'removed'}),
  setFavouriteDriverProperty: (name) => setUserProperty(fa(),'favourite_driver', name?.substring(0, 36)),

  gridTabSwitched: (tab) => logEvent(fa(),'grid_tab_switched', {tab}),
  newsSearched: (query) => logEvent(fa(),'search', {search_term: query?.substring(0, 100)}),
  searchOpened: () => logEvent(fa(),'search_opened'),
  searchClosed: () => logEvent(fa(),'search_closed'),

  infoPageViewed: (pageId) => logEvent(fa(),'info_page_viewed', {page_id: pageId}),
  moreItemClicked: (item) => logEvent(fa(),'more_item_clicked', {item}),

  notificationTypeToggled: (type, enabled) => logEvent(fa(),'notification_type_toggled', {type, enabled: enabled ? 'true' : 'false'}),
  unitSystemChanged: (unit) => logEvent(fa(),'unit_system_changed', {unit}),

  bugReportSubmitted: (category) => logEvent(fa(),'bug_report_submitted', {category}),

  roadmapVoted: (itemId) => logEvent(fa(),'roadmap_voted', {item_id: itemId}),
  roadmapIdeaSubmitted: () => logEvent(fa(),'roadmap_idea_submitted'),

  pullToRefresh: (screen) => logEvent(fa(),'pull_to_refresh', {screen}),
  retryClicked: (screen) => logEvent(fa(),'retry_clicked', {screen}),
  scrollToTop: (screen) => logEvent(fa(),'scroll_to_top', {screen}),
  navItemClicked: (label) => logEvent(fa(),'nav_item_clicked', {label}),

  notificationDelivered: (type, venue) => logEvent(fa(),'notification_delivered', {type, ...(venue ? {venue} : {})}),
  notificationOpened: (type) => logEvent(fa(),'notification_opened', {type}),

  adImpression: (placement) => logEvent(fa(),'ad_impression', {placement}),
  adClicked: (placement) => logEvent(fa(),'ad_clicked', {placement}),
};
