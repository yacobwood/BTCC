const {buildSessionAlertPayload} = require('../../functions/sessionAlerts');

// Regression coverage: Race 3's "15 minutes before" alert is the only
// session alert that also links to the starting grid instead of live
// timing - merged in rather than a separate earlier notification, since by
// this point the reverse-grid draw (BTCC reg 3.4.1.b) is reliably already
// published.

describe('buildSessionAlertPayload', () => {
  const now = new Date('2026-08-16T12:00:00Z');

  it('Race 3 body mentions the starting grid', () => {
    const {body} = buildSessionAlertPayload({name: 'Race 3'}, {venue: 'Snetterton'}, now);
    expect(body).toBe('Race 3 at Snetterton is about to get underway. Tap to see the starting grid.');
  });

  it('Race 3 data deep-links to the grid tab, not live timing', () => {
    const round = {venue: 'Snetterton', round: 7, tslEventId: 12345};
    const {data} = buildSessionAlertPayload({name: 'Race 3'}, round, now);
    expect(data).toEqual({type: 'results', round: '7', year: '2026', race: '3'});
  });

  it('Race 3 uses the calendar year the alert actually fires in', () => {
    const laterNow = new Date('2027-01-05T09:00:00Z');
    const {data} = buildSessionAlertPayload({name: 'Race 3'}, {venue: 'X', round: 1}, laterNow);
    expect(data.year).toBe('2027');
  });

  it('other sessions keep the plain body, unchanged', () => {
    const {body} = buildSessionAlertPayload({name: 'Race 2'}, {venue: 'Snetterton'}, now);
    expect(body).toBe('Race 2 at Snetterton is about to get underway');
  });

  it('other sessions still deep-link to live timing when tslEventId is set', () => {
    const round = {venue: 'Snetterton', round: 7, tslEventId: 12345};
    const {data} = buildSessionAlertPayload({name: 'Race 2'}, round, now);
    expect(data).toEqual({type: 'livetiming', eventId: '12345'});
  });

  it('other sessions have no data payload when tslEventId is not set', () => {
    const {data} = buildSessionAlertPayload({name: 'Qualifying'}, {venue: 'Snetterton'}, now);
    expect(data).toBeNull();
  });

  it('Race 3 ignores tslEventId entirely - grid link always wins', () => {
    const round = {venue: 'Snetterton', round: 7, tslEventId: 12345};
    const {data} = buildSessionAlertPayload({name: 'Race 3'}, round, now);
    expect(data.type).toBe('results');
  });
});
