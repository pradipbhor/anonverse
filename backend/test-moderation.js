import * as dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';
import leoProfanity from 'leo-profanity';

console.log('\n==============================');
console.log('  MODERATION SERVICE TEST');
console.log('==============================\n');

// ─── CHECK DEPENDENCIES ──────────────────────────────────────
try {
  leoProfanity.check('test');
  console.log('✅ leo-profanity package found');
} catch {
  console.error('❌ leo-profanity not installed — run: npm install leo-profanity');
  process.exit(1);
}

// ─── CHECK TOKEN ─────────────────────────────────────────────
const token = process.env.HF_API_TOKEN;
if (!token) {
  console.warn('⚠️  HF_API_TOKEN not set — Layer 2 (Hugging Face) will be skipped\n');
} else {
  console.log('✅ HF_API_TOKEN found');
  console.log('   Prefix:', token.substring(0, 5) + '...\n');
}

// ─── TEST CASES ──────────────────────────────────────────────
const LOCAL_CASES = [
  { label: 'Clean message',   content: 'Hey how are you today?',   expectFlagged: false },
  { label: 'Profanity',       content: 'You are a stupid asshole', expectFlagged: true  },
  { label: 'Extra blocklist', content: 'kill yourself loser',      expectFlagged: true  },
];

const HF_CASES = [
  { label: 'Clean message',  content: 'I love playing video games',   expectFlagged: false },
  { label: 'Hate speech',    content: 'I hate all people from X',     expectFlagged: true  },
  { label: 'Violence',       content: 'I want to hurt someone badly', expectFlagged: true  },
  { label: 'Insult',         content: 'You are a complete idiot',     expectFlagged: true  },
];

// unitary/toxic-bert: active model, covers toxic/obscene/threat/insult/identity_hate
const HF_URL = 'https://router.huggingface.co/hf-inference/models/unitary/toxic-bert';

// A result is flagged if any harmful label scores above this threshold
const THRESHOLD = 0.5;

// ─── LAYER 1 TESTS ───────────────────────────────────────────
async function testLayer1() {
  console.log('─────────────────────────────');
  console.log('  LAYER 1 — Local leo-profanity');
  console.log('─────────────────────────────\n');

  const extraBlocklist = ['kill yourself', 'kys', 'csam'];
  let passed = 0, failed = 0;

  for (const t of LOCAL_CASES) {
    process.stdout.write(`  [${t.label}] ... `);

    const lower = t.content.toLowerCase();
    const extraHit = extraBlocklist.some(w => lower.includes(w));
    const profane = leoProfanity.check(t.content);
    const flagged = extraHit || profane;

    const correct = flagged === t.expectFlagged;
    correct ? passed++ : failed++;

    console.log(correct ? '✅ PASS' : '❌ FAIL');
    console.log(`     Flagged   : ${flagged}`);
    console.log(`     Expected  : ${t.expectFlagged}`);
    if (flagged) {
      console.log(`     Reason    : ${extraHit ? 'extra-blocklist' : 'profanity'}`);
    }
    console.log();
  }

  console.log(`  Layer 1 Results: ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

// ─── LAYER 2 TESTS ───────────────────────────────────────────
async function testLayer2() {
  console.log('─────────────────────────────');
  console.log('  LAYER 2 — Hugging Face API');
  console.log('  Model: unitary/toxic-bert');
  console.log('─────────────────────────────\n');

  if (!token) {
    console.log('  ⚠️  Skipped — HF_API_TOKEN not set\n');
    console.log('  To enable Layer 2:');
    console.log('  1. Go to huggingface.co → sign up (free, no card)');
    console.log('  2. Settings → Access Tokens → New token');
    console.log('  3. Add to .env: HF_API_TOKEN=hf_xxxxxxxxx\n');
    return true;
  }

  let passed = 0, failed = 0;

  for (const t of HF_CASES) {
    process.stdout.write(`  [${t.label}] ... `);

    try {
      const response = await axios.post(
        HF_URL,
        { inputs: t.content },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      // toxic-bert returns [[{label, score}, ...]] — one array per input
      const results = Array.isArray(response.data[0])
        ? response.data[0]
        : response.data;

      if (!results || !results.length) {
        console.log('❌ FAIL — empty response');
        failed++;
        console.log();
        continue;
      }

      // Flag if ANY harmful label exceeds threshold
      const harmfulLabels = results.filter(r =>
        r.label !== 'toxic' // 'toxic' is the umbrella; check specific ones too
          ? r.score > THRESHOLD
          : r.score > THRESHOLD
      );

      const flagged = harmfulLabels.length > 0;
      const correct = flagged === t.expectFlagged;
      correct ? passed++ : failed++;

      console.log(correct ? '✅ PASS' : '❌ FAIL');
      console.log(`     Flagged   : ${flagged}`);
      console.log(`     Expected  : ${t.expectFlagged}`);

      // Show all scores above 1%
      const notable = results
        .filter(r => r.score > 0.01)
        .sort((a, b) => b.score - a.score)
        .map(r => `${r.label}=${(r.score * 100).toFixed(1)}%`);
      if (notable.length) {
        console.log(`     Scores    : ${notable.join(' | ')}`);
      }
      console.log();

    } catch (err) {
      failed++;
      console.log('❌ ERROR');
      console.log(`     Status  : ${err.response?.status || 'N/A'}`);
      console.log(`     Message : ${err.message}`);

      if (err.response?.status === 401) {
        console.log('\n  💡 Fix: Invalid HF token.');
        console.log('     Go to: huggingface.co → Settings → Access Tokens\n');
      } else if (err.response?.status === 503) {
        console.log('\n  💡 Model is loading (cold start). Wait 20s and retry.\n');
      } else if (err.response?.status === 410) {
        console.log('\n  💡 Model was removed from HF. The model URL needs updating.\n');
      } else if (err.code === 'ECONNABORTED') {
        console.log('\n  💡 Request timed out. Check your internet connection.\n');
      }
      console.log();
    }
  }

  console.log(`  Layer 2 Results: ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

// ─── RUN ─────────────────────────────────────────────────────
async function run() {
  const l1 = await testLayer1();
  const l2 = await testLayer2();

  console.log('==============================');
  if (l1 && l2) {
    console.log('  ✅ ModerationService ready!');
  } else {
    console.log('  ❌ Fix errors above');
    process.exit(1);
  }
  console.log('==============================\n');
}

run().catch(err => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});