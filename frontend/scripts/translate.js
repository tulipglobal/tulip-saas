const https = require('https');
const fs = require('fs');
const path = require('path');

const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
const MESSAGES_DIR = path.join(__dirname, '../src/messages');

const TARGETS = [
  { code: 'fr', deepl: 'FR' },
  { code: 'es', deepl: 'ES' },
  { code: 'pt', deepl: 'PT-PT' },
  { code: 'it', deepl: 'IT' },
];

const SEPARATOR = '\n§§§\n';

function flattenObject(obj, prefix = '') {
  const result = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      result.push(...flattenObject(value, path));
    } else {
      result.push({ path, value: String(value) });
    }
  }
  return result;
}

function unflattenObject(entries) {
  const result = {};
  for (const { path, value } of entries) {
    const keys = path.split('.');
    let obj = result;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
  }
  return result;
}

async function translateBatch(texts, targetLang) {
  // Protect {variables} from translation
  const protected = texts.map(t => t.replace(/\{(\w+)\}/g, '<var>$1</var>'));

  // Join all texts with a unique separator so DeepL translates as one request
  const combined = protected.join(SEPARATOR);

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      text: [combined],
      target_lang: targetLang,
      source_lang: 'EN',
      tag_handling: 'xml',
      ignore_tags: ['var']
    });

    const options = {
      hostname: 'api-free.deepl.com',
      path: '/v2/translate',
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString();
        try {
          const parsed = JSON.parse(data);
          if (parsed.translations && parsed.translations[0]) {
            const translated = parsed.translations[0].text;
            // Split back and restore {variables}
            const results = translated.split(SEPARATOR).map(t =>
              t.trim().replace(/<var>(\w+)<\/var>/g, '{$1}')
            );
            resolve(results);
          } else {
            reject(new Error(`Unexpected response: ${data.slice(0, 500)}`));
          }
        } catch (e) {
          reject(new Error(`JSON parse failed: ${e.message} — response: ${data.slice(0, 500)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  if (!DEEPL_API_KEY) {
    console.error('DEEPL_API_KEY not set');
    process.exit(1);
  }

  const en = JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, 'en.json'), 'utf8'));
  const flat = flattenObject(en);
  const texts = flat.map(e => e.value);

  console.log(`Found ${texts.length} strings to translate\n`);

  for (const { code, deepl } of TARGETS) {
    const outPath = path.join(MESSAGES_DIR, `${code}.json`);

    // Skip if already translated (re-run safe)
    if (fs.existsSync(outPath)) {
      const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      if (JSON.stringify(existing) !== JSON.stringify(en)) {
        console.log(`✓ ${code}.json already translated — skipping`);
        continue;
      }
    }

    console.log(`Translating → ${deepl}...`);
    try {
      const translated = await translateBatch(texts, deepl);

      if (translated.length !== flat.length) {
        console.error(`  ⚠ Expected ${flat.length} strings, got ${translated.length} — saving partial`);
      }

      const entries = flat.map((e, i) => ({
        path: e.path,
        value: i < translated.length ? translated[i] : e.value
      }));

      const result = unflattenObject(entries);
      fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
      console.log(`✓ Saved ${code}.json (${translated.length} strings)`);

      // Small delay between languages to avoid rate limits
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error(`✗ Failed ${code}: ${err.message}`);
    }
  }

  console.log('\n✅ Done');
}

main().catch(console.error);
