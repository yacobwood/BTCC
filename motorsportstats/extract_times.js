const fs = require('fs');
const puppeteer = require('puppeteer');

async function fetchHtml(browser, url) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36');
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const html = await page.content();
    await page.close();
    return html;
  } catch (e) {
    if (page && !page.isClosed()) await page.close();
    throw e;
  }
}

function extractNextData(html) {
  const match = html.match(/id=\"__NEXT_DATA__\" type=\"application\/json\">(.+?)<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch (e) {
    console.error("JSON parse error", e);
  }
  return null;
}

async function getRaceSlugsForEvent(browser, year, eventSlug) {
  const shortEventSlug = eventSlug.replace(`british-touring-car-championship_${year}_`, '');
  const url = `https://www.motorsportstats.com/results/british-touring-car-championship/${year}/${shortEventSlug}/classification`;
  
  try {
    const html = await fetchHtml(browser, url);
    const data = extractNextData(html);
    if (!data) return [];
    
    const sessions = data.props?.pageProps?.sessions || [];
    const raceSlugs = [];
    for (const s of sessions) {
      if (s.name && s.name.toLowerCase().includes('race')) {
        raceSlugs.push(s.slug);
      }
    }
    return raceSlugs;
  } catch (e) {
    console.error(`Failed to get sessions for ${eventSlug}:`, e.message);
    return [];
  }
}

async function fetchClassificationDetails(browser, year, shortEventSlug, sessionSlug) {
  const url = `https://www.motorsportstats.com/results/british-touring-car-championship/${year}/${shortEventSlug}/classification/${sessionSlug}`;
  try {
    const html = await fetchHtml(browser, url);
    const data = extractNextData(html);
    if (data && data.props?.pageProps?.sessionClassification?.details) {
      return data.props.pageProps.sessionClassification.details;
    }
  } catch (e) {
    console.error(`Error fetching classification ${sessionSlug}:`, e.message);
  }
  return null;
}

async function processYear(browser, year) {
  console.log(`\n=== Processing ${year} ===`);
  const fileName = `./${year}.json`;
  
  if (!fs.existsSync(fileName)) {
    console.error(`File ${fileName} not found.`);
    return;
  }
  
  const data = JSON.parse(fs.readFileSync(fileName, 'utf8'));
  
  const events = [];
  for (const race of data.races) {
    const evSlug = race.event.slug;
    if (!events.find(e => e.slug === evSlug)) {
       events.push({ slug: evSlug, races: [] });
    }
    events.find(e => e.slug === evSlug).races.push(race);
  }
  
  console.log(`Found ${events.length} unique events for ${year}.`);
  
  for (const event of events) {
    console.log(`\nFetching sessions for event: ${event.slug}...`);
    const shortEventSlug = event.slug.replace(`british-touring-car-championship_${year}_`, '');
    
    // Add delay between events so we don't trigger ratelimits
    await new Promise(r => setTimeout(r, 1500));
    
    const sessionSlugs = await getRaceSlugsForEvent(browser, year, event.slug);
    
    if (sessionSlugs.length === 0) {
      console.log(` -> Failed to find race sessions for ${event.slug}`);
      continue;
    }
    
    console.log(` -> Found ${sessionSlugs.length} race sessions:`, sessionSlugs);
    event.races.sort((a,b) => a.raceNumberInSeason - b.raceNumberInSeason);
    
    for (let i = 0; i < Math.min(event.races.length, sessionSlugs.length); i++) {
       const raceRecord = event.races[i];
       const rNum = raceRecord.raceNumberInSeason;
       const sSlug = sessionSlugs[i];
       
       console.log(`   [Race ${rNum}] Fetching classification for ${sSlug}...`);
       
       // Add delay between session fetches to respect rate limits
       await new Promise(r => setTimeout(r, 1000));
       
       const classification = await fetchClassificationDetails(browser, year, shortEventSlug, sSlug);
       if (!classification) {
         console.log(`     -> Failed to get details.`);
         continue;
       }
       console.log(`     -> Success: ${classification.length} drivers.`);
       
       const classMap = {};
       for (const c of classification) {
         let dSlug = null;
         if (c.driver && c.driver.slug) dSlug = c.driver.slug;
         if (c.drivers && c.drivers.length > 0 && c.drivers[0].slug) dSlug = c.drivers[0].slug;
         if (dSlug) {
           classMap[dSlug] = {
             time: c.time,
             gap: c.gap,
             avgLapSpeed: c.avgLapSpeed,
             bestLap: c.bestLap,
             lapsCount: c.lapsCount || c.laps
           };
         }
       }
       
       let updateCount = 0;
       for (const standing of data.standings) {
         const dSlug = standing.driver.slug;
         if (classMap[dSlug]) {
           const raceObj = standing.races.find(r => r.raceNumberInSeason === rNum);
           if (raceObj) {
             raceObj.timing = classMap[dSlug];
             updateCount++;
           }
         }
       }
       console.log(`     -> Injected timing data for ${updateCount} drivers.`);
    }
  }
  
  fs.writeFileSync(fileName, JSON.stringify(data, null, 2));
  console.log(`\n=== Done processing ${year} ===\n`);
}

async function run() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    await processYear(browser, 2014);
    await processYear(browser, 2015);
  } catch(e) {
    console.error('Fatal error', e);
  } finally {
    await browser.close();
  }
}

run();
