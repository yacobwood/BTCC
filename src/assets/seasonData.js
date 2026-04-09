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
