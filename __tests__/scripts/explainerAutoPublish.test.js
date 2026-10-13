const fs = require('fs');
const {londonParts, selectDue, publishArticle, runPublish, MAX_OVERDUE_DAYS} = require('../../scripts/explainerAutoPublish');

const post = (over = {}) => ({id: 'explainer-a', title: 'A', status: 'staged', accepted: true, scheduledDate: '2026-10-16', ...over});

describe('londonParts', () => {
  it('uses BST in summer', () => {
    expect(londonParts(new Date('2026-10-16T18:07:00Z'))).toEqual({date: '2026-10-16', hour: 19});
  });
  it('uses GMT after the clocks go back', () => {
    expect(londonParts(new Date('2026-11-03T18:07:00Z'))).toEqual({date: '2026-11-03', hour: 18});
  });
});

describe('selectDue', () => {
  it('picks accepted, unpublished articles dated today', () => {
    const {due} = selectDue([post()], '2026-10-16');
    expect(due.map(p => p.id)).toEqual(['explainer-a']);
  });
  it('never picks an article that is not accepted', () => {
    expect(selectDue([post({accepted: undefined}), post({accepted: false})], '2026-10-16').due).toEqual([]);
  });
  it('skips already-published and future articles', () => {
    expect(selectDue([post({status: 'published'}), post({scheduledDate: '2026-10-17'})], '2026-10-16').due).toEqual([]);
  });
  it('skips articles with no scheduled date', () => {
    expect(selectDue([post({scheduledDate: undefined})], '2026-10-16').due).toEqual([]);
  });
  it('catches up within the overdue window but not beyond it', () => {
    const inWindow = post({id: 'in', scheduledDate: '2026-10-13'});
    const tooOld = post({id: 'old', scheduledDate: '2026-10-12'});
    expect(MAX_OVERDUE_DAYS).toBe(3);
    const {due, overdue} = selectDue([inWindow, tooOld], '2026-10-16');
    expect(due.map(p => p.id)).toEqual(['in']);
    expect(overdue.map(p => p.id)).toEqual(['old']);
  });
});

describe('publishArticle', () => {
  it('uses and consumes the notification overrides', () => {
    const p = post({notifTitleOverride: 'Introducing BTCC Academy', notifBodyOverride: 'Body', imageUrl: 'https://x/img.webp'});
    const notif = publishArticle(p, '2026-10-16T18:07:00.000Z');
    expect(notif).toEqual({id: 'explainer-a', title: 'Introducing BTCC Academy', body: 'Body', imageUrl: 'https://x/img.webp'});
    expect(p.status).toBe('published');
    expect(p.pubDate).toBe('2026-10-16T18:07:00.000Z');
    expect(p.notifTitleOverride).toBeUndefined();
    expect(p.notifBodyOverride).toBeUndefined();
  });
  it('falls back to the headline with an empty body', () => {
    expect(publishArticle(post(), 'now')).toEqual({id: 'explainer-a', title: 'A', body: '', imageUrl: ''});
  });
});

describe('runPublish', () => {
  let written;
  beforeEach(() => {
    written = null;
    jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({posts: [post(), post({id: 'explainer-b', accepted: undefined})]}));
    jest.spyOn(fs, 'writeFileSync').mockImplementation((_, data) => { written = JSON.parse(data); });
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('does nothing before 7pm London time', () => {
    expect(runPublish({now: new Date('2026-10-16T17:07:00Z')})).toEqual([]);
    expect(written).toBeNull();
  });
  it('publishes only the accepted article at 7pm', () => {
    const notifs = runPublish({now: new Date('2026-10-16T18:07:00Z')});
    expect(notifs.map(n => n.id)).toEqual(['explainer-a']);
    expect(written.posts.find(p => p.id === 'explainer-a').status).toBe('published');
    expect(written.posts.find(p => p.id === 'explainer-b').status).toBe('staged');
  });
  it('does nothing after 21:59 London time (a late trigger must not notify at night)', () => {
    expect(runPublish({now: new Date('2026-10-16T21:05:00Z')})).toEqual([]);
    expect(written).toBeNull();
  });
  it('still publishes at 21:xx London time', () => {
    expect(runPublish({now: new Date('2026-10-16T20:55:00Z')}).map(n => n.id)).toEqual(['explainer-a']);
  });
  it('a manual (forced) run ignores the hour', () => {
    expect(runPublish({now: new Date('2026-10-16T08:00:00Z'), force: true}).map(n => n.id)).toEqual(['explainer-a']);
  });
});
