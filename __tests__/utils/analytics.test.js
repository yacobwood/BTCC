import {logEvent, setUserProperty} from '@react-native-firebase/analytics';
import {Analytics} from '../../src/utils/analytics';

describe('Analytics', () => {
  describe('screen', () => {
    it('logs screen_view with screen_name', () => {
      Analytics.screen('Home');
      expect(logEvent).toHaveBeenCalledWith(
        expect.anything(),
        'screen_view',
        {screen_name: 'Home'},
      );
    });
  });

  describe('article events', () => {
    it('articleClicked logs select_content with title and position', () => {
      Analytics.articleClicked('BTCC opener', 2);
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'select_content', {
        content_type: 'article',
        item_id: 'BTCC opener',
        position: 2,
      });
    });

    it('articleClicked truncates title to 100 chars', () => {
      const longTitle = 'A'.repeat(150);
      Analytics.articleClicked(longTitle, 0);
      const call = logEvent.mock.calls[0][2];
      expect(call.item_id.length).toBeLessThanOrEqual(100);
    });

    it('articleShared logs share event', () => {
      Analytics.articleShared('Title');
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'share', {
        content_type: 'article',
        item_id: 'Title',
      });
    });

    it('articleScrollDepth logs depth_percent', () => {
      Analytics.articleScrollDepth('Title', 75);
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'article_scroll_depth', {
        item_name: 'Title',
        depth_percent: 75,
      });
    });

    it('articleExternalLinkClicked logs url truncated to 100 chars', () => {
      const url = 'https://example.com/' + 'x'.repeat(200);
      Analytics.articleExternalLinkClicked('Title', url);
      const call = logEvent.mock.calls[0][2];
      expect(call.url.length).toBeLessThanOrEqual(100);
    });

    it('handles null title gracefully', () => {
      expect(() => Analytics.articleClicked(null, 0)).not.toThrow();
      const call = logEvent.mock.calls[0][2];
      expect(call.item_id).toBe('');
    });
  });

  describe('calendar events', () => {
    it('trackDetailViewed logs with round and venue', () => {
      Analytics.trackDetailViewed(3, 'Snetterton');
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'track_detail_viewed', {round: 3, venue: 'Snetterton'});
    });

    it('raceClicked logs with round and venue', () => {
      Analytics.raceClicked(1, 'Donington Park');
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'race_clicked', {round: 1, venue: 'Donington Park'});
    });

    it('liveTimingOpened logs with venue', () => {
      Analytics.liveTimingOpened('Brands Hatch');
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'live_timing_opened', {venue: 'Brands Hatch'});
    });
  });

  describe('results events', () => {
    it('resultsYearChanged logs year', () => {
      Analytics.resultsYearChanged(2025);
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'results_year_changed', {year: 2025});
    });

    it('roundResultsViewed logs year and round', () => {
      Analytics.roundResultsViewed(2026, 4);
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'round_results_viewed', {year: 2026, round: 4});
    });
  });

  describe('driver & team events', () => {
    it('driverClicked logs driver_name', () => {
      Analytics.driverClicked('Tom Ingram');
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'driver_clicked', {driver_name: 'Tom Ingram'});
    });

    it('teamClicked logs team_name', () => {
      Analytics.teamClicked('Team Vertu');
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'team_clicked', {team_name: 'Team Vertu'});
    });

    it('favouriteToggled with added=true logs action "added"', () => {
      Analytics.favouriteToggled('Tom Ingram', true);
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'favourite_toggled', {
        driver_name: 'Tom Ingram',
        action: 'added',
      });
    });

    it('favouriteToggled with added=false logs action "removed"', () => {
      Analytics.favouriteToggled('Tom Ingram', false);
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'favourite_toggled', {
        driver_name: 'Tom Ingram',
        action: 'removed',
      });
    });

    it('setFavouriteDriverProperty calls setUserProperty truncated to 36 chars', () => {
      const longName = 'A'.repeat(50);
      Analytics.setFavouriteDriverProperty(longName);
      const call = setUserProperty.mock.calls[0];
      expect(call[2].length).toBeLessThanOrEqual(36);
    });
  });

  describe('notification events', () => {
    it('notificationTypeToggled with enabled=true passes "true" string', () => {
      Analytics.notificationTypeToggled('race', true);
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'notification_type_toggled', {
        type: 'race',
        enabled: 'true',
      });
    });

    it('notificationTypeToggled with enabled=false passes "false" string', () => {
      Analytics.notificationTypeToggled('news', false);
      const call = logEvent.mock.calls[0][2];
      expect(call.enabled).toBe('false');
    });

    it('notificationDelivered logs type (and optional venue)', () => {
      Analytics.notificationDelivered('race', 'Donington Park');
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'notification_delivered', {
        type: 'race',
        venue: 'Donington Park',
      });
    });

    it('notificationDelivered without venue omits venue key', () => {
      Analytics.notificationDelivered('news');
      const call = logEvent.mock.calls[0][2];
      expect(call).not.toHaveProperty('venue');
    });

    it('notificationOpened logs type', () => {
      Analytics.notificationOpened('results');
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'notification_opened', {type: 'results'});
    });
  });

  describe('ad events', () => {
    it('adImpression logs placement', () => {
      Analytics.adImpression('news_feed');
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'ad_impression', {placement: 'news_feed'});
    });

    it('adClicked logs placement', () => {
      Analytics.adClicked('track_detail');
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'ad_clicked', {placement: 'track_detail'});
    });
  });

  describe('search events', () => {
    it('newsSearched truncates query to 100 chars', () => {
      const query = 'q'.repeat(120);
      Analytics.newsSearched(query);
      const call = logEvent.mock.calls[0][2];
      expect(call.search_term.length).toBeLessThanOrEqual(100);
    });
  });

  describe('misc events', () => {
    it('pullToRefresh logs screen', () => {
      Analytics.pullToRefresh('News');
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'pull_to_refresh', {screen: 'News'});
    });

    it('bugReportSubmitted logs category', () => {
      Analytics.bugReportSubmitted('crash');
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'bug_report_submitted', {category: 'crash'});
    });

    it('unitSystemChanged logs unit', () => {
      Analytics.unitSystemChanged('km');
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), 'unit_system_changed', {unit: 'km'});
    });
  });
});
