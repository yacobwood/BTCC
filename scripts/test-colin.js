#!/usr/bin/env node
/**
 * Colin AI test pack
 * Run: node scripts/test-colin.js
 *
 * Queries the deployed askBtccAi function with a variety of questions and
 * prints each response alongside the expected answer for manual verification.
 */

const URL = 'https://europe-west1-btcchub-af77a.cloudfunctions.net/askBtccAi';

const TESTS = [
  // ── All-time records ──────────────────────────────────────────────────────
  {
    category: 'All-time records',
    question: 'Who has the most wins ever in BTCC?',
    expected: 'Jason Plato, 97 wins',
  },
  {
    category: 'All-time records',
    question: 'Who has the most podiums in BTCC history?',
    expected: 'Colin Turkington, 186 podiums',
  },
  {
    category: 'All-time records',
    question: 'Who has won the most BTCC championships?',
    expected: 'Three drivers share the record with 4 titles each: Colin Turkington, Ashley Sutton and Andy Rouse',
  },
  {
    category: 'All-time records',
    question: 'Who has scored the most points in BTCC history?',
    expected: 'Colin Turkington, 5252 points',
  },

  // ── 2026 standings ────────────────────────────────────────────────────────
  {
    category: '2026 standings',
    question: 'Who leads the 2026 drivers championship?',
    expected: 'Ashley Sutton, 129 points',
  },
  {
    category: '2026 standings',
    question: 'What is the gap between 1st and 2nd in the 2026 championship?',
    expected: '47 points (Sutton 129, Ingram 82)',
  },
  {
    category: '2026 standings',
    question: 'Who is leading the 2026 independents trophy?',
    expected: 'Mikey Doble, 68 points',
  },

  // ── 2026 race results ─────────────────────────────────────────────────────
  {
    category: '2026 results',
    question: 'Who won Race 1 at Donington Park in 2026?',
    expected: 'Mikey Doble (LKQ Euro Car Parts with Power Maxed Racing)',
  },
  {
    category: '2026 results',
    question: 'Who won the qualifying race at Brands Hatch in 2026?',
    expected: 'Ashley Sutton (NAPA Racing UK)',
  },
  {
    category: '2026 results',
    question: 'Who won Race 2 at Brands Hatch in 2026?',
    expected: 'Árón Taylor-Smith (Laser Tools Racing with MB Motorsport)',
  },
  {
    category: '2026 results',
    question: 'How many races has Ashley Sutton won in 2026?',
    expected: '4 (Donington R2 and R3, Brands Hatch qualifying race and R1)',
  },

  // ── Calendar ──────────────────────────────────────────────────────────────
  {
    category: 'Calendar',
    question: 'When is the next BTCC round in 2026?',
    expected: 'Round 3, Snetterton, 23 May 2026',
  },
  {
    category: 'Calendar',
    question: 'Where is the final round of the 2026 BTCC season?',
    expected: 'Brands Hatch GP, 10 October 2026',
  },

  // ── Points and regulations ────────────────────────────────────────────────
  {
    category: 'Regulations',
    question: 'How many points does a BTCC race win earn?',
    expected: '20 points (plus 1 for fastest lap and 1 for race leader)',
  },
  {
    category: 'Regulations',
    question: 'How many points does a qualifying race win earn?',
    expected: '10 points (no bonus points in the qualifying race)',
  },
  {
    category: 'Regulations',
    question: 'How is the Race 3 grid decided?',
    expected: 'Finishing order of Race 2 with the top 6 positions reversed - the exact number 1-6 is drawn at random',
  },

  // ── Hypothetical calculations ─────────────────────────────────────────────
  {
    category: 'Hypothetical',
    question: 'If Sutton DNFs the next 3 races and Ingram wins all 3, who leads the championship and by how many points?',
    expected: 'Ingram leads by 13 points (Ingram 142, Sutton 129)',
  },
  {
    category: 'Hypothetical',
    question: 'How many points would a driver score if they finished 3rd in all 3 championship races at a round?',
    expected: '45 points (15 per race × 3)',
  },

  // ── Off-topic rejection ───────────────────────────────────────────────────
  {
    category: 'Off-topic',
    question: 'Who won the Formula 1 championship in 2023?',
    expected: 'Exact phrase: "I can only answer questions about the BTCC."',
  },
  {
    category: 'Off-topic',
    question: "What's the weather like in Manchester?",
    expected: 'Exact phrase: "I can only answer questions about the BTCC."',
  },
];

async function ask(question) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({question}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data.answer;
}

async function run() {
  let pass = 0;
  let total = TESTS.length;
  const results = [];

  for (const test of TESTS) {
    process.stdout.write(`[${test.category}] ${test.question}\n`);
    try {
      const answer = await ask(test.question);
      results.push({...test, answer, error: null});
      console.log(`  EXPECTED : ${test.expected}`);
      console.log(`  ACTUAL   : ${answer}`);
      console.log('');
    } catch (e) {
      results.push({...test, answer: null, error: e.message});
      console.log(`  ERROR    : ${e.message}\n`);
    }
  }

  console.log('─'.repeat(60));
  console.log(`Ran ${total} questions. Review EXPECTED vs ACTUAL above.`);
  console.log('Off-topic questions should return the exact refusal phrase.');
}

run().catch(console.error);
