const {onSchedule} = require('firebase-functions/v2/scheduler');
const {onRequest} = require('firebase-functions/v2/https');
const {getFirestore} = require('firebase-admin/firestore');
const {GoogleAuth} = require('google-auth-library');
const {logError, fetchWithTimeout, getUKDateString, requireAdminPost} = require('./shared');

// ── Analytics sync — daily at 8am ─────────────────────────────
// Fetches key metrics from GA4 and writes to Firestore analytics/summary
// so they can be queried without needing direct Firebase Console access.
// Also upserts the last 30 days into analytics_daily_history so the admin
// dashboard's daily chart updates every morning rather than waiting on
// exportAnalyticsHistory's Monday-only refresh.
const GA4_PROPERTY_ID = '528813863';

exports.syncAnalytics = onSchedule(
  {schedule: '0 8 * * *', timeZone: 'Europe/London', secrets: ['GMAIL_APP_PASSWORD']},
  async () => { try {
    const db = getFirestore();
    const auth = new GoogleAuth({scopes: ['https://www.googleapis.com/auth/analytics.readonly']});
    const client = await auth.getClient();
    const {token} = await client.getAccessToken();

    const runReport = async (body) => {
      const res = await fetchWithTimeout(
        `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
        15000,
        {method: 'POST', headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'}, body: JSON.stringify(body)},
      );
      const json = await res.json();
      if (json.error) throw new Error(`GA4 API error: ${JSON.stringify(json.error)}`);
      return json;
    };

    const [overviewReport, sourcesReport, dailyReport] = await Promise.all([
      // New + active users across three windows
      runReport({
        dateRanges: [
          {startDate: 'today', endDate: 'today', name: '1d'},
          {startDate: '7daysAgo', endDate: 'today', name: '7d'},
          {startDate: '29daysAgo', endDate: 'today', name: '30d'},
        ],
        metrics: [{name: 'newUsers'}, {name: 'activeUsers'}],
      }),
      // Acquisition sources for the last 7 days
      runReport({
        dateRanges: [{startDate: '7daysAgo', endDate: 'today'}],
        dimensions: [{name: 'sessionSource'}, {name: 'sessionMedium'}],
        metrics: [{name: 'newUsers'}, {name: 'sessions'}],
        orderBys: [{metric: {metricName: 'newUsers'}, desc: true}],
        limit: 10,
      }),
      // Daily breakdown for the last 30 days
      runReport({
        dateRanges: [{startDate: '29daysAgo', endDate: 'today'}],
        dimensions: [{name: 'date'}],
        metrics: [{name: 'newUsers'}, {name: 'activeUsers'}, {name: 'sessions'}],
        orderBys: [{dimension: {dimensionName: 'date'}}],
      }),
    ]);

    // Overview — each row corresponds to a named date range
    const overview = {};
    for (const row of overviewReport.rows || []) {
      const name = row.dimensionValues?.[0]?.value;
      overview[name] = {
        newUsers: parseInt(row.metricValues?.[0]?.value || '0'),
        activeUsers: parseInt(row.metricValues?.[1]?.value || '0'),
      };
    }

    // Acquisition sources
    const topSources = (sourcesReport.rows || []).map(row => ({
      source: row.dimensionValues?.[0]?.value,
      medium: row.dimensionValues?.[1]?.value,
      newUsers: parseInt(row.metricValues?.[0]?.value || '0'),
      sessions: parseInt(row.metricValues?.[1]?.value || '0'),
    }));

    // Daily new users — date is YYYYMMDD from GA4
    const dailyNewUsers = (dailyReport.rows || []).map(row => ({
      date: row.dimensionValues?.[0]?.value,
      newUsers: parseInt(row.metricValues?.[0]?.value || '0'),
      activeUsers: parseInt(row.metricValues?.[1]?.value || '0'),
    }));

    await db.collection('analytics').doc('summary').set({
      updatedAt: new Date().toISOString(),
      overview,
      topSources,
      dailyNewUsers,
    });

    // Also upsert each of the last 30 days into analytics_daily_history -
    // the flat per-day collection the admin dashboard's daily chart reads.
    // exportAnalyticsHistory only refreshes that chart's live tail once a
    // week (Mondays); running here too means the chart catches up every
    // morning instead of sitting up to 6 days stale. Plain overwrites, same
    // as backfillAnalyticsDaily, so this also lets GA4 correct a day's
    // still-processing figures for a day or two after it first appears.
    const dailyHistoryRef = db.collection('analytics_daily_history');
    const batch = db.batch();
    for (const row of dailyReport.rows || []) {
      const raw = row.dimensionValues?.[0]?.value || '';
      const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
      batch.set(dailyHistoryRef.doc(date), {
        date,
        newUsers: parseInt(row.metricValues?.[0]?.value || '0'),
        activeUsers: parseInt(row.metricValues?.[1]?.value || '0'),
        sessions: parseInt(row.metricValues?.[2]?.value || '0'),
      });
    }
    await batch.commit();

    console.log('syncAnalytics: done', JSON.stringify(overview));
  } catch (e) {
    console.error('syncAnalytics failed:', e);
    await logError('syncAnalytics', e.message, e, {alert: true});
  }},
);

// ── Analytics weekly export — permanent historical record ─────
// syncAnalytics above only ever keeps a rolling 30-day snapshot (one
// Firestore doc, overwritten daily) - nothing preserves older weeks
// anywhere under our own control once GA4's own reporting window moves
// on. This appends one immutable document per week instead, keyed by
// the week's start date, so we have a permanent, ever-growing archive
// independent of GA4's own data retention settings - as much of GA4's
// own data as the readonly scope already granted can reach: overview
// totals, a daily breakdown, acquisition sources, platform/OS split and
// a UK city breakdown, not just a handful of headline numbers.
//
// Only ever fetches one week of GA4 data per run - totalUsersAllTime is
// accumulated by reading the previous week's own stored figure and
// adding this week's newUsers to it, rather than re-querying GA4's
// entire history every week (which would only get slower and larger
// over time). Only the very first run ever, with no prior week stored
// yet, does a one-time full-history GA4 fetch to seed that baseline.
//
// Doesn't capture GA4's "Retained users" - that comes from a separate
// cohort-based Retention report (a different request shape, cohortSpec),
// not a plain metric on runReport. Also doesn't touch GA4's own Data
// Retention setting (2 vs 14 months) or BigQuery Export - both are
// one-time GA4 Admin console changes that need a broader analytics.edit
// scope than this function has (or should have, for a scheduled job that
// only ever needs to read).
exports.exportAnalyticsHistory = onSchedule(
  {schedule: '5 8 * * 1', timeZone: 'Europe/London', secrets: ['GMAIL_APP_PASSWORD']},
  async () => { try {
    const db = getFirestore();
    const auth = new GoogleAuth({scopes: ['https://www.googleapis.com/auth/analytics.readonly']});
    const client = await auth.getClient();
    const {token} = await client.getAccessToken();

    const runReport = async (body) => {
      const res = await fetchWithTimeout(
        `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
        15000,
        {method: 'POST', headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'}, body: JSON.stringify(body)},
      );
      const json = await res.json();
      if (json.error) throw new Error(`GA4 API error: ${JSON.stringify(json.error)}`);
      return json;
    };

    const weekRange = [{startDate: '7daysAgo', endDate: 'yesterday'}];

    const [overviewReport, dailyReport, sourcesReport, platformReport, ukCitiesReport] = await Promise.all([
      runReport({
        dateRanges: weekRange,
        metrics: [
          {name: 'newUsers'}, {name: 'activeUsers'}, {name: 'sessions'},
          {name: 'screenPageViews'}, {name: 'averageSessionDuration'},
          {name: 'engagementRate'}, {name: 'bounceRate'},
        ],
      }),
      // Day-by-day within the week, so the archive keeps the same shape of
      // detail the daily Looker Studio chart shows, not just a weekly total.
      runReport({
        dateRanges: weekRange,
        dimensions: [{name: 'date'}],
        metrics: [{name: 'newUsers'}, {name: 'activeUsers'}, {name: 'sessions'}],
        orderBys: [{dimension: {dimensionName: 'date'}}],
      }),
      runReport({
        dateRanges: weekRange,
        dimensions: [{name: 'sessionSource'}, {name: 'sessionMedium'}],
        metrics: [{name: 'newUsers'}, {name: 'sessions'}],
        orderBys: [{metric: {metricName: 'newUsers'}, desc: true}],
        limit: 10,
      }),
      runReport({
        dateRanges: weekRange,
        dimensions: [{name: 'platform'}, {name: 'operatingSystem'}],
        metrics: [{name: 'activeUsers'}, {name: 'sessions'}],
        orderBys: [{metric: {metricName: 'activeUsers'}, desc: true}],
      }),
      // Where in the UK users are browsing from - city-level, filtered to
      // country == United Kingdom so international noise doesn't crowd out
      // the breakdown the admin page actually wants to show.
      runReport({
        dateRanges: weekRange,
        dimensions: [{name: 'city'}],
        metrics: [{name: 'activeUsers'}, {name: 'sessions'}],
        dimensionFilter: {
          filter: {fieldName: 'country', stringFilter: {value: 'United Kingdom', matchType: 'EXACT'}},
        },
        orderBys: [{metric: {metricName: 'activeUsers'}, desc: true}],
        limit: 10,
      }),
    ]);

    const overviewRow = overviewReport.rows?.[0];
    const dailyBreakdown = (dailyReport.rows || []).map(row => {
      const raw = row.dimensionValues?.[0]?.value || '';
      return {
        // Reformatted to YYYY-MM-DD (GA4 returns bare YYYYMMDD) so these
        // dates match analytics_daily_history's format and dedupe/merge
        // correctly instead of appearing as separate, wrongly-sorted days.
        date: `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`,
        newUsers: parseInt(row.metricValues?.[0]?.value || '0'),
        activeUsers: parseInt(row.metricValues?.[1]?.value || '0'),
        sessions: parseInt(row.metricValues?.[2]?.value || '0'),
      };
    });
    const topSources = (sourcesReport.rows || []).map(row => ({
      source: row.dimensionValues?.[0]?.value,
      medium: row.dimensionValues?.[1]?.value,
      newUsers: parseInt(row.metricValues?.[0]?.value || '0'),
      sessions: parseInt(row.metricValues?.[1]?.value || '0'),
    }));
    const platformBreakdown = (platformReport.rows || []).map(row => ({
      platform: row.dimensionValues?.[0]?.value,
      operatingSystem: row.dimensionValues?.[1]?.value,
      activeUsers: parseInt(row.metricValues?.[0]?.value || '0'),
      sessions: parseInt(row.metricValues?.[1]?.value || '0'),
    }));
    // GA4 returns '(not set)' for sessions it can't resolve to a city (VPNs,
    // some mobile carriers) - kept as-is rather than filtered out, so the
    // admin chart's totals still reconcile with activeUsers elsewhere.
    const ukCities = (ukCitiesReport.rows || []).map(row => ({
      city: row.dimensionValues?.[0]?.value,
      activeUsers: parseInt(row.metricValues?.[0]?.value || '0'),
      sessions: parseInt(row.metricValues?.[1]?.value || '0'),
    }));
    const newUsersThisWeek = parseInt(overviewRow?.metricValues?.[0]?.value || '0');

    // Running total is accumulated from last week's own stored figure
    // rather than re-querying GA4's entire history every week (which only
    // gets larger and slower over time) - only the very first run ever,
    // with no prior week stored yet, needs a one-time full-history GA4
    // fetch to establish a baseline.
    const historyRef = db.collection('analytics_history');
    const prevSnap = await historyRef.orderBy('weekStart', 'desc').limit(1).get();

    let totalUsersAllTime;
    if (!prevSnap.empty) {
      totalUsersAllTime = (prevSnap.docs[0].data().totalUsersAllTime || 0) + newUsersThisWeek;
    } else {
      const bootstrapReport = await runReport({
        dateRanges: [{startDate: '2024-01-01', endDate: 'yesterday'}],
        metrics: [{name: 'totalUsers'}],
      });
      totalUsersAllTime = parseInt(bootstrapReport.rows?.[0]?.metricValues?.[0]?.value || '0');
    }

    const weekStart = getUKDateString(new Date(), -7);

    await historyRef.doc(weekStart).set({
      weekStart,
      weekEnd: getUKDateString(new Date(), -1),
      exportedAt: new Date().toISOString(),
      newUsers: newUsersThisWeek,
      activeUsers: parseInt(overviewRow?.metricValues?.[1]?.value || '0'),
      sessions: parseInt(overviewRow?.metricValues?.[2]?.value || '0'),
      screenPageViews: parseInt(overviewRow?.metricValues?.[3]?.value || '0'),
      averageSessionDuration: parseFloat(overviewRow?.metricValues?.[4]?.value || '0'),
      engagementRate: parseFloat(overviewRow?.metricValues?.[5]?.value || '0'),
      bounceRate: parseFloat(overviewRow?.metricValues?.[6]?.value || '0'),
      totalUsersAllTime,
      dailyBreakdown,
      topSources,
      platformBreakdown,
      ukCities,
    });

    console.log('exportAnalyticsHistory: done', weekStart);
  } catch (e) {
    console.error('exportAnalyticsHistory failed:', e);
    await logError('exportAnalyticsHistory', e.message, e, {alert: true});
  }},
);

// ── One-time daily history backfill — admin-triggered, not scheduled ──
// syncAnalytics only keeps the trailing 30 days in analytics_daily_history,
// and exportAnalyticsHistory's own dailyBreakdown only goes back to its
// first run (2026-07-27+). This fills every earlier day GA4 still has, so
// the admin dashboard's daily chart can show the full season instead of
// starting mid-way through. Re-running it is safe - each date's doc is
// just overwritten - so it also works to extend the backfill further back
// later if needed.
exports.backfillAnalyticsDaily = onRequest(
  {secrets: ['GMAIL_APP_PASSWORD'], cors: ['https://yacobwood.github.io']},
  async (req, res) => {
    if (requireAdminPost(req, res)) return;

    try {
      const db = getFirestore();
      const auth = new GoogleAuth({scopes: ['https://www.googleapis.com/auth/analytics.readonly']});
      const client = await auth.getClient();
      const {token} = await client.getAccessToken();

      const gaRes = await fetchWithTimeout(
        `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
        30000,
        {
          method: 'POST',
          headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'},
          body: JSON.stringify({
            dateRanges: [{startDate: '2024-01-01', endDate: 'yesterday'}],
            dimensions: [{name: 'date'}],
            metrics: [{name: 'newUsers'}, {name: 'activeUsers'}, {name: 'sessions'}],
            orderBys: [{dimension: {dimensionName: 'date'}}],
            limit: 5000,
          }),
        },
      );
      const gaJson = await gaRes.json();
      if (gaJson.error) throw new Error(`GA4 API error: ${JSON.stringify(gaJson.error)}`);

      const days = (gaJson.rows || []).map(row => {
        const raw = row.dimensionValues?.[0]?.value || '';
        return {
          date: `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`,
          newUsers: parseInt(row.metricValues?.[0]?.value || '0'),
          activeUsers: parseInt(row.metricValues?.[1]?.value || '0'),
          sessions: parseInt(row.metricValues?.[2]?.value || '0'),
        };
      });

      const dailyRef = db.collection('analytics_daily_history');
      for (let i = 0; i < days.length; i += 500) {
        const batch = db.batch();
        days.slice(i, i + 500).forEach(d => batch.set(dailyRef.doc(d.date), d));
        await batch.commit();
      }

      console.log('backfillAnalyticsDaily: done', days.length, 'days');
      res.status(200).json({ok: true, days: days.length});
    } catch (e) {
      console.error('backfillAnalyticsDaily failed:', e);
      await logError('backfillAnalyticsDaily', e.message, e, {alert: true});
      res.status(500).json({ok: false, error: e.message});
    }
  },
);
