// Bundled season data with official standings (2004-2025)
const seasons = {
  2004: require('./data/season_2004.json'),
  2005: require('./data/season_2005.json'),
  2006: require('./data/season_2006.json'),
  2007: require('./data/season_2007.json'),
  2008: require('./data/season_2008.json'),
  2009: require('./data/season_2009.json'),
  2010: require('./data/season_2010.json'),
  2011: require('./data/season_2011.json'),
  2012: require('./data/season_2012.json'),
  2013: require('./data/season_2013.json'),
  2014: require('./data/season_2014.json'),
  2015: require('./data/season_2015.json'),
  2016: require('./data/season_2016.json'),
  2017: require('./data/season_2017.json'),
  2018: require('./data/season_2018.json'),
  2019: require('./data/season_2019.json'),
  2020: require('./data/season_2020.json'),
  2021: require('./data/season_2021.json'),
  2022: require('./data/season_2022.json'),
  2023: require('./data/season_2023.json'),
  2024: require('./data/season_2024.json'),
  2025: require('./data/season_2025.json'),
};

export function getSeasonData(year) {
  return seasons[year] || null;
}

// Computed once at module load — all data is bundled so this is synchronous.
const MIN_STARTS = 30;

// Official all-time records — auto-scraped from motorsportstats.com
// To refresh: run tools/scraper/scrape_records.py then copy data/records/records.json here
const MSS = require('./data/records.json');

// Legacy alias used by DRIVER_RECORDS championship lookup
const CHAMPIONSHIPS_OFFICIAL = MSS.championships;

// ── Hand-crafted lookup tables removed — ALL_TIME_RECORDS now reads from MSS ──
// (WINS_OFFICIAL etc. retained below only to avoid a large diff; they are unused)

const WINS_OFFICIAL = {
  'Jason Plato': 94, 'Colin Turkington': 72, 'Matt Neal': 63, 'Andy Rouse': 53,
  'Gordon Shedden': 53, 'Ashley Sutton': 47, 'Tom Ingram': 40, 'Alain Menu': 36,
  'James Thompson': 36, 'Yvan Muller': 34, 'Mat Jackson': 31, 'Andrew Jordan': 26,
  'Fabrizio Giovanardi': 24, 'Jake Hill': 23, 'Rickard Rydell': 21, 'Josh Cook': 21,
  'John Cleland': 18, 'Tom Chilton': 18, 'Tim Harvey': 16, 'Dan Cammish': 16,
  'Jeff Allam': 15, 'Anthony Reid': 15, 'Rob Collard': 15, 'Steve Soper': 14,
  'Gordon Spice': 13, 'Robb Gravett': 13, 'Joachim Winkelhock': 13, 'Frank Biela': 13,
  'Gabriele Tarquini': 12, 'Adam Morgan': 11, 'Rory Butcher': 11, 'Laurent Aiello': 10,
  'Will Hoy': 9, 'David Leslie': 9, 'Peter Lovett': 8, 'Sam Tordoff': 8,
  'Win Percy': 7, 'Tom Onslow-Cole': 7, 'Paul Radisich': 6, 'Dan Eaves': 6,
  'Vince Woodman': 5, 'Darren Turner': 5, 'Jack Goff': 5, 'Aiden Moffat': 5,
  'Daniel Rowbottom': 5, 'Daniel Lloyd': 5, 'Árón Taylor-Smith': 4, 'Stephen Jelley': 4,
  'Robert Huff': 4, 'John Morris': 3, 'Chris Hodgetts': 3, 'Tom Kristensen': 3,
  'Simon Harrison': 3, 'Simon Graves': 3, 'Warren Hughes': 3, 'Luke Hines': 3,
  'Gareth Howell': 3, 'Andy Priaulx': 3, 'Rob Austin': 2, 'Tom Walkinshaw': 2,
  'David Brodie': 2, 'Frank Sytner': 2, 'Mike Newman': 2, 'Pete Hall': 2,
  'David Sears': 2, 'Kelvin Burt': 2, 'John Bintcliffe': 2, 'Phil Bennett': 2,
  'Paul O\'Neill': 2, 'Dave Newsham': 2, 'Ollie Jackson': 2, 'Tom Oliphant': 2,
  'Senna Proctor': 2, 'Colin Vandervell': 1, 'Brian Muir': 1, 'Stuart Graham': 1,
  'Richard Lloyd': 1, 'Tony Lanfranchi': 1, 'Nick Whiting': 1, 'Barrie Williams': 1,
  'Tony Pond': 1, 'James Weaver': 1, 'Dennis Leech': 1, 'Mike O\'Brien': 1,
  'Rob Speak': 1, 'Jerry Mahony': 1, 'Gianfranco Brancatelli': 1, 'Laurence Bristow': 1,
  'Tiff Needell': 1, 'Mike Smith': 1, 'Tim Sugden': 1, 'Julian Bailey': 1,
  'Giampiero Simoni': 1, 'Roberto Ravaglia': 1, 'Derek Warwick': 1, 'Peter Kox': 1,
  'Roger Moen': 1, 'Alan Morrison': 1, 'Mike Jordan': 1,
};

const PODIUMS_OFFICIAL = {
  'Jason Plato': 233, 'Matt Neal': 193, 'Colin Turkington': 192, 'Gordon Shedden': 143,
  'Ashley Sutton': 113, 'Tom Ingram': 112, 'James Thompson': 105, 'Andy Rouse': 100,
  'Yvan Muller': 89, 'Alain Menu': 88, 'Mat Jackson': 79, 'Andrew Jordan': 74,
  'Tom Chilton': 69, 'Rickard Rydell': 66, 'Jake Hill': 66, 'Rob Collard': 63,
  'Dan Cammish': 61, 'Fabrizio Giovanardi': 57, 'Josh Cook': 55, 'John Cleland': 50,
  'Tim Harvey': 50, 'Anthony Reid': 50, 'Adam Morgan': 47, 'Jeff Allam': 45,
  'David Leslie': 39, 'Tom Onslow-Cole': 36, 'Will Hoy': 33, 'Steve Soper': 32,
  'Sam Tordoff': 32, 'Frank Biela': 31, 'Rory Butcher': 31, 'Gabriele Tarquini': 27,
  'Robb Gravett': 25, 'Dan Eaves': 25, 'Gordon Spice': 24, 'Árón Taylor-Smith': 22,
  'Paul Radisich': 21, 'Joachim Winkelhock': 21, 'Jack Goff': 21, 'Daniel Rowbottom': 20,
  'Vince Woodman': 19, 'Peter Lovett': 19, 'Win Percy': 18, 'Rob Austin': 18,
  'Paul O\'Neill': 18, 'Aiden Moffat': 16, 'Laurent Aiello': 15, 'David Brodie': 14,
  'Frank Sytner': 14, 'Darren Turner': 14, 'Stephen Jelley': 14, 'Andy Priaulx': 13,
  'Senna Proctor': 13, 'Mike Newman': 12, 'Robert Huff': 11, 'Chris Smiley': 11,
  'Warren Hughes': 10, 'Tom Oliphant': 10, 'Giampiero Simoni': 9, 'John Bintcliffe': 9,
  'Daniel Lloyd': 9, 'Dave Newsham': 8, 'Alan Morrison': 8, 'Chris Craft': 7,
  'John Morris': 7, 'Dennis Leech': 7, 'Graham Goode': 7, 'Kelvin Burt': 7,
  'Tom Kristensen': 7, 'Mike Jordan': 7, 'Adam Jones': 7, 'Frank Wrathall': 7,
  'Mikey Doble': 3, 'Daryl DeLeon': 3,
};

const POLES_OFFICIAL = {
  'Jason Plato': 98, 'Colin Turkington': 64, 'Andy Rouse': 46, 'Matt Neal': 43,
  'Rickard Rydell': 41, 'James Thompson': 38, 'Alain Menu': 35, 'Gordon Shedden': 35,
  'Tom Chilton': 31, 'Tom Ingram': 30, 'Ashley Sutton': 28, 'Yvan Muller': 22,
  'Andrew Jordan': 22, 'Dan Cammish': 21, 'Anthony Reid': 18, 'Mat Jackson': 18,
  'Josh Cook': 18, 'David Leslie': 18, 'Jake Hill': 18, 'Sam Tordoff': 15,
  'Steve Soper': 14, 'John Cleland': 14, 'Joachim Winkelhock': 14, 'Adam Morgan': 14,
  'Robb Gravett': 13, 'Fabrizio Giovanardi': 13, 'Rob Collard': 12, 'Tom Onslow-Cole': 12,
  'Gordon Spice': 12, 'Jeff Allam': 11, 'Jack Goff': 11, 'Laurent Aiello': 10,
  'Gabriele Tarquini': 10, 'Rory Butcher': 10, 'Stephen Jelley': 10, 'Aiden Moffat': 9,
  'David Brodie': 8, 'Frank Biela': 8, 'Vince Woodman': 7, 'Andy Priaulx': 7,
  'Will Hoy': 6, 'Paul Radisich': 6, 'Darren Turner': 5, 'Dave Newsham': 5,
  'Peter Lovett': 5, 'Tim Harvey': 5, 'Dan Eaves': 5, 'Alex MacDowall': 5,
  'Rob Austin': 5, 'Senna Proctor': 5, 'Daniel Rowbottom': 5, 'Daniel Lloyd': 5,
  'Gareth Howell': 4, 'Mike Jordan': 4, 'Paul O\'Neill': 4, 'James Cole': 4,
  'Robert Huff': 4, 'Chris Smiley': 3, 'Tom Kristensen': 3, 'Phil Bennett': 3,
  'Warren Hughes': 3, 'Luke Hines': 3, 'Mark Proctor': 3, 'Adam Jones': 3,
  'Jeff Smith': 3, 'Mikey Doble': 3, 'Daryl DeLeon': 3, 'Tom Walkinshaw': 2,
  'Richard Lloyd': 2, 'Tony Pond': 2, 'Mike O\'Brien': 2, 'Tim Sugden': 2,
  'Giampiero Simoni': 2, 'Gavin Smith': 2, 'John George': 2, 'Ollie Jackson': 2,
  'Matt Simpson': 2, 'Tom Oliphant': 2, 'Bobby Thompson': 2, 'Ronan Pearson': 2,
  'Sam Osborne': 2, 'Jonathan Buncombe': 2, 'Brian Muir': 1, 'Martin Brundle': 1,
  'Rod Dougal': 1, 'James Weaver': 1, 'Neil McGrath': 1, 'Barry Sheene': 1,
  'Dennis Leech': 1, 'Frank Sytner': 1, 'Graham Goode': 1, 'Laurence Bristow': 1,
  'Mike Newman': 1, 'Jerry Mahony': 1, 'Gianfranco Brancatelli': 1, 'Gary Ayles': 1,
};

const FL_OFFICIAL = {
  'Jason Plato': 88, 'Colin Turkington': 76, 'Gordon Shedden': 58, 'Ashley Sutton': 55,
  'Matt Neal': 52, 'Tom Ingram': 44, 'Andy Rouse': 41, 'Yvan Muller': 29,
  'Anthony Reid': 28, 'James Thompson': 28, 'Alain Menu': 27, 'Josh Cook': 27,
  'Mat Jackson': 25, 'Rickard Rydell': 21, 'Andrew Jordan': 21, 'Tom Chilton': 20,
  'David Leslie': 17, 'Fabrizio Giovanardi': 17, 'Rob Collard': 17, 'Jeff Allam': 16,
  'Jake Hill': 15, 'Robb Gravett': 14, 'Joachim Winkelhock': 14, 'Tom Onslow-Cole': 14,
  'Steve Soper': 13, 'Sam Tordoff': 13, 'Adam Morgan': 13, 'Dan Cammish': 13,
  'Gabriele Tarquini': 12, 'John Cleland': 11, 'Win Percy': 10, 'David Brodie': 10,
  'Will Hoy': 10, 'Frank Biela': 10, 'Paul Radisich': 9, 'Tim Harvey': 8,
  'Darren Turner': 8, 'Rory Butcher': 8, 'Gordon Spice': 7, 'Dan Eaves': 7,
  'Vince Woodman': 6, 'Jack Goff': 6, 'Árón Taylor-Smith': 6, 'Chris Hodgetts': 5,
  'Tom Kristensen': 5, 'Daniel Rowbottom': 5, 'Peter Lovett': 4, 'Laurent Aiello': 4,
  'Warren Hughes': 4, 'Gareth Howell': 4, 'Rob Austin': 4, 'Tom Oliphant': 4,
  'Pete Hall': 3, 'Peter Kox': 3, 'Alan Morrison': 3, 'Mike Jordan': 3,
  'Paul O\'Neill': 3, 'Andy Priaulx': 3, 'Daniel Lloyd': 3, 'Charles Bamford': 3,
  'Chris Craft': 2, 'Tom Walkinshaw': 2, 'Brian Muir': 2, 'Mike O\'Brien': 2,
  'Ray Bellm': 2, 'Giampiero Simoni': 2, 'Julian Bailey': 2, 'Kelvin Burt': 2,
  'Vincent Radermecker': 2, 'Shaun Watson-Smith': 2, 'Steven Kane': 2, 'James Nash': 2,
  'Alex MacDowall': 2, 'Frank Wrathall': 2, 'Dave Newsham': 2, 'Aiden Moffat': 2,
  'James Cole': 2, 'Senna Proctor': 2, 'Stephen Jelley': 2, 'Ronan Pearson': 2,
  'Chris Smiley': 2, 'Barrie Williams': 1, 'Stuart Graham': 1, 'Richard Lloyd': 1,
  'Rex Greenslade': 1, 'Nick Whiting': 1, 'Stirling Moss': 1, 'Mike Buckley': 1,
  'James Weaver': 1, 'Neil McGrath': 1, 'Dennis Leech': 1, 'Jean-Louis Schlesser': 1,
  'Frank Sytner': 1, 'Graham Goode': 1, 'David Carvell': 1, 'Laurence Bristow': 1,
  'Mike Newman': 1, 'Jerry Mahony': 1, 'Gianfranco Brancatelli': 1, 'Gary Ayles': 1,
};

// All-time race starts
const STARTS_OFFICIAL = {
  'Matt Neal': 719, 'Jason Plato': 658, 'Colin Turkington': 569, 'Tom Chilton': 532,
  'Rob Collard': 489, 'Gordon Shedden': 437, 'Adam Morgan': 411, 'Aiden Moffat': 390,
  'Andrew Jordan': 358, 'Tom Ingram': 367, 'Mat Jackson': 333, 'Árón Taylor-Smith': 326,
  'Josh Cook': 320, 'Ashley Sutton': 297, 'James Kaye': 298, 'Ollie Jackson': 293,
  'Jake Hill': 287, 'James Thompson': 286, 'Stephen Jelley': 282, 'Jack Goff': 262,
  'Tim Harvey': 247, 'Alain Menu': 229, 'Rob Austin': 229, 'Chris Smiley': 222,
  'John Cleland': 214, 'David Leslie': 218, 'Dan Cammish': 207, 'Sam Osborne': 205,
  'Yvan Muller': 202, 'Tom Onslow-Cole': 198, 'Rory Butcher': 189, 'Will Hoy': 185,
  'Anthony Reid': 185, 'Dave Newsham': 181, 'Daniel Rowbottom': 180, 'Andy Rouse': 175,
  'Sam Tordoff': 173, 'Rickard Rydell': 170, 'Paul O\'Neill': 167, 'Daniel Lloyd': 164,
  'Senna Proctor': 154, 'John George': 163, 'Nicolas Hamilton': 160, 'Jeff Smith': 156,
  'Robb Gravett': 152, 'Fabrizio Giovanardi': 152, 'Andy Neate': 148, 'Patrick Watts': 147,
  'Daniel Welch': 144, 'James Cole': 144, 'Dan Eaves': 139, 'Martin Depper': 127,
  'Jeff Allam': 126, 'David Pinkney': 125, 'Tom Boardman': 124, 'Bobby Thompson': 123,
  'Paul Radisich': 131, 'Jason Hughes': 130, 'Leo Wood': 121, 'Nick Foster': 121,
  'Tom Oliphant': 119, 'Matt Simpson': 97, 'Martyn Bell': 110, 'Jack Butel': 107,
  'Steve Soper': 106, 'Michael Crees': 106, 'Chris Hodgetts': 101, 'Warren Scott': 100,
  'John Dooley': 98, 'Gareth Howell': 93, 'Graham Goode': 92, 'Carl Boardley': 92,
  'Jade Edwards': 92, 'Mike Jordan': 90, 'Dexter Patterson': 90, 'Mikey Doble': 89,
  'Alan Curnow': 88, 'Hunter Abbott': 88, 'Kelvin Burt': 88, 'Luke Hines': 85,
  'John Morris': 84, 'Nick Halstead': 84, 'Adam Jones': 83, 'Richard Longman': 82,
  'Frank Sytner': 82, 'Frank Wrathall': 82, 'Gabriele Tarquini': 81, 'James Nash': 81,
  'Mike Bushell': 77, 'John Bintcliffe': 77, 'Alan Morrison': 76, 'Liam Griffin': 76,
  'Win Percy': 75, 'Stewart Lines': 75, 'Daryl DeLeon': 75, 'Darren Turner': 74,
  'Mike Newman': 73, 'Derek Warwick': 73, 'Ricky Collard': 72, 'Chris Stockton': 71,
};

// Laps led (2025 season)
const LAPS_LED_OFFICIAL = {
  'Jake Hill': 331, 'Ashley Sutton': 316, 'Tom Ingram': 276, 'Colin Turkington': 214,
  'Dan Cammish': 102, 'Tom Chilton': 65, 'Daniel Rowbottom': 58, 'Josh Cook': 47,
  'Robert Huff': 42, 'Daniel Lloyd': 38, 'Ronan Pearson': 36, 'Charles Rainford': 34,
  'Mikey Doble': 29, 'Adam Morgan': 27, 'Ricky Collard': 23, 'Sam Osborne': 22,
  'Aiden Moffat': 21, 'Gordon Shedden': 19, 'Daryl DeLeon': 11, 'Árón Taylor-Smith': 7,
  'Stephen Jelley': 5, 'Rory Butcher': 1,
};

// Best consecutive podium streak per driver
const PODIUM_STREAK_OFFICIAL = {
  'Andy Rouse': 13, 'Jason Plato': 13, 'Matt Neal': 11, 'Yvan Muller': 10,
  'Robb Gravett': 8, 'Mat Jackson': 8, 'John Cleland': 7, 'Alain Menu': 7,
  'Ashley Sutton': 7, 'Gordon Spice': 6, 'Peter Lovett': 6, 'Steve Soper': 6,
  'Tim Harvey': 6, 'Gabriele Tarquini': 6, 'Paul Radisich': 6, 'Laurent Aiello': 6,
  'Colin Turkington': 6, 'Vince Woodman': 5, 'Jeff Allam': 5, 'Neil McGrath': 5,
  'Andrew Jordan': 5, 'Jake Hill': 5, 'Will Hoy': 4, 'Win Percy': 4,
  'Robb Gravett': 4, 'Rickard Rydell': 4, 'Frank Biela': 4, 'Roberto Ravaglia': 4,
  'Anthony Reid': 4, 'James Thompson': 4, 'Paul O\'Neill': 4, 'Dan Eaves': 4,
  'Frank Wrathall': 4, 'Gordon Shedden': 4,
};

// Best single-season podium count per driver
const PODIUMS_BEST_SEASON_OFFICIAL = {
  'Jason Plato': 22, 'Alain Menu': 21, 'Frank Biela': 20, 'Matt Neal': 20,
  'Ashley Sutton': 20, 'Colin Turkington': 19, 'John Cleland': 18, 'Gordon Shedden': 18,
  'Tom Ingram': 18, 'Rickard Rydell': 17, 'Yvan Muller': 17, 'Fabrizio Giovanardi': 17,
  'Dan Eaves': 16, 'Jake Hill': 16, 'Anthony Reid': 15, 'Laurent Aiello': 15,
  'Gabriele Tarquini': 14, 'James Thompson': 14, 'Dan Cammish': 14, 'David Leslie': 13,
  'Andrew Jordan': 12, 'Robb Gravett': 11, 'Tom Onslow-Cole': 11, 'Andy Rouse': 10,
  'Will Hoy': 10, 'Paul Radisich': 10, 'Mat Jackson': 10,
};

// Best consecutive pole position streak per driver
const POLE_STREAK_OFFICIAL = {
  'Andy Rouse': 8, 'Rickard Rydell': 6, 'Alain Menu': 6, 'Yvan Muller': 6,
  'Robb Gravett': 5, 'Will Hoy': 5, 'Steve Soper': 4, 'David Brodie': 4,
  'Anthony Reid': 4, 'Jason Plato': 4, 'Gordon Spice': 3, 'Win Percy': 3,
  'Paul Radisich': 3, 'Gabriele Tarquini': 3, 'John Cleland': 3, 'Frank Biela': 3,
  'Laurent Aiello': 3, 'James Thompson': 3, 'Matt Neal': 3, 'Jack Goff': 3,
  'Dan Cammish': 3, 'Tim Sugden': 2, 'David Leslie': 2, 'Joachim Winkelhock': 2,
  'Tim Harvey': 2, 'Jeff Allam': 2, 'Vince Woodman': 2, 'Luke Hines': 2,
  'Tom Chilton': 2, 'Colin Turkington': 2,
};

// Best single-season pole position count per driver
const POLES_BEST_SEASON_OFFICIAL = {
  'Rickard Rydell': 13, 'Alain Menu': 13, 'Anthony Reid': 11, 'Laurent Aiello': 10,
  'Ashley Sutton': 10, 'Andy Rouse': 9, 'Robb Gravett': 9, 'Yvan Muller': 9,
  'James Thompson': 9, 'Jason Plato': 8, 'Colin Turkington': 8, 'David Brodie': 7,
  'Joachim Winkelhock': 7, 'Matt Neal': 7, 'Tom Ingram': 7, 'Gordon Spice': 6,
  'Frank Biela': 6, 'Fabrizio Giovanardi': 6, 'Tom Chilton': 6, 'Mat Jackson': 6,
  'Dan Cammish': 6, 'Win Percy': 5, 'Steve Soper': 5, 'Will Hoy': 5,
  'Gabriele Tarquini': 5, 'Gordon Shedden': 5, 'Andrew Jordan': 5, 'Jack Goff': 5,
  'Jeff Allam': 4, 'Vince Woodman': 4, 'John Cleland': 4, 'David Leslie': 4,
  'Tom Onslow-Cole': 4, 'Sam Tordoff': 4, 'Stephen Jelley': 4, 'Jake Hill': 4,
  'Josh Cook': 4, 'Dan Eaves': 4,
};

// Keep the champions lookup for DRIVER_RECORDS
const CHAMPIONS = CHAMPIONSHIPS_OFFICIAL;

export const DRIVER_RECORDS = (() => {
  const map = {};
  for (const season of Object.values(seasons)) {
    for (const round of season.rounds || []) {
      for (const race of round.races || []) {
        for (const result of race.results || []) {
          const name = result.driver || result.name;
          if (!name) continue;
          if (!map[name]) map[name] = {wins: 0, podiums: 0, fastestLaps: 0, poles: 0, dnfs: 0, starts: 0, points: 0, seasonSet: new Set()};
          const s = map[name];
          s.starts++;
          s.points += result.points || 0;
          if (result.pos === 1) s.wins++;
          if (result.pos >= 1 && result.pos <= 3) s.podiums++;
          if (result.fl || result.fastestLap) s.fastestLaps++;
          if (result.p || result.pole) s.poles++;
          if (result.pos === 0) s.dnfs++;
          if (season.season) s.seasonSet.add(season.season);
        }
      }
    }
  }
  return Object.entries(map)
    .filter(([, s]) => s.starts >= MIN_STARTS)
    .map(([driver, s]) => ({
      driver,
      wins: s.wins,
      podiums: s.podiums,
      fastestLaps: s.fastestLaps,
      poles: s.poles,
      dnfs: s.dnfs,
      starts: s.starts,
      points: s.points,
      seasons: s.seasonSet.size,
      championships: CHAMPIONS[driver] || 0,
      winPct: s.wins / s.starts,
      podiumPct: s.podiums / s.starts,
      pointsPerStart: s.points / s.starts,
      dnfPct: s.dnfs / s.starts,
    }));
})();

// All-time records — sourced from MSS (records.json), all drivers, no minimum starts
export const ALL_TIME_RECORDS = (() => {
  const tables = [
    MSS.wins, MSS.podiums, MSS.poles, MSS.fastestLaps,
    MSS.championships, MSS.starts, MSS.lapsLed, MSS.racesLed,
    MSS.hatTricks, MSS.winStreak, MSS.bestSeasonWins,
    MSS.podiumStreak, MSS.bestSeasonPodiums,
    MSS.poleStreak, MSS.bestSeasonPoles,
    MSS.consecutiveFinishes, MSS.consecutivePoints, MSS.dnfs,
  ];
  const allDrivers = new Set(tables.flatMap(t => Object.keys(t || {})));
  const get = (table, driver) => table?.[driver] || 0;
  return [...allDrivers].map(driver => ({
    driver,
    championships:      get(MSS.championships,      driver),
    starts:             get(MSS.starts,             driver),
    wins:               get(MSS.wins,               driver),
    podiums:            get(MSS.podiums,            driver),
    poles:              get(MSS.poles,              driver),
    fastestLaps:        get(MSS.fastestLaps,        driver),
    lapsLed:            get(MSS.lapsLed,            driver),
    racesLed:           get(MSS.racesLed,           driver),
    hatTricks:          get(MSS.hatTricks,          driver),
    winStreak:          get(MSS.winStreak,          driver),
    bestSeasonWins:     get(MSS.bestSeasonWins,     driver),
    podiumStreak:       get(MSS.podiumStreak,       driver),
    bestSeasonPodiums:  get(MSS.bestSeasonPodiums,  driver),
    poleStreak:         get(MSS.poleStreak,         driver),
    bestSeasonPoles:    get(MSS.bestSeasonPoles,    driver),
    consecutive:        get(MSS.consecutiveFinishes, driver),
    consecutivePoints:  get(MSS.consecutivePoints,  driver),
    dnfs:               get(MSS.dnfs,               driver),
  }));
})();

// Keep old export name for any existing import sites
export const WIN_STATS = [...DRIVER_RECORDS].sort((a, b) => b.winPct - a.winPct);
