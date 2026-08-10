// Pure helper for sendSessionNotifications' "15 minutes before" session
// alerts (functions/index.js) - extracted into its own file (same pattern
// as newsCheck.js) purely so it can be unit tested without pulling in
// index.js's unconditional initializeApp() call at module load time.
//
// Race 3's grid is a reverse-grid derived from Race 2's result (BTCC reg
// 3.4.1.b) - by the time this 15-minutes-before alert fires the grid is
// reliably already published (see project_race3_grid_notification memory
// for the investigation that established this), so the grid link is
// folded into this existing alert - deep-linking to the grid instead of
// live timing - rather than a separate earlier notification for it.
function buildSessionAlertPayload(session, round, now) {
  const isRace3 = session.name === 'Race 3';
  const body = isRace3
    ? `${session.name} at ${round.venue} is about to get underway. Tap to see the starting grid.`
    : `${session.name} at ${round.venue} is about to get underway`;
  const data = isRace3
    ? {type: 'results', round: String(round.round), year: String(now.getFullYear()), race: '3'}
    : (round.tslEventId ? {type: 'livetiming', eventId: String(round.tslEventId)} : null);
  return {body, data};
}

module.exports = {buildSessionAlertPayload};
