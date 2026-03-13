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

const BATCH_SIZE = 25; // Send 25 strings per API call

function flattenObject(obj, prefix = '') {
  const result = [];
  for (const [key, value] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      result.push(...flattenObject(value, p));
    } else {
      result.push({ path: p, value: String(value) });
    }
  }
  return result;
}

function unflattenObject(entries) {
  const result = {};
  for (const { path: p, value } of entries) {
    const keys = p.split('.');
    let obj = result;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
  }
  return result;
}

/**
 * Translate an array of texts using DeepL's native text[] parameter.
 * Each text is sent as a separate element — no separator hacks.
 * {variables} are protected using XML ignore_tags.
 */
async function translateBatch(texts, targetLang) {
  // Protect {variables} from translation using XML tags
  const prepared = texts.map(t =>
    t.replace(/&/g, '&amp;')
     .replace(/</g, '&lt;')
     .replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;')
     .replace(/\{(\w+)\}/g, '<var>$1</var>')
  );

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      text: prepared,
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
          if (parsed.translations && Array.isArray(parsed.translations)) {
            const results = parsed.translations.map(t =>
              t.text
                .replace(/<var>(\w+)<\/var>/g, '{$1}')
                .replace(/&quot;/g, '"')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
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
      const existingFlat = flattenObject(existing);
      // Only skip if existing file has the same number of keys
      if (existingFlat.length === flat.length) {
        console.log(`✓ ${code}.json already has ${existingFlat.length} keys — skipping`);
        continue;
      }
      console.log(`  ${code}.json has ${existingFlat.length} keys, expected ${flat.length} — re-translating`);
    }

    console.log(`Translating → ${deepl}...`);
    try {
      const allTranslated = [];

      // Send in batches of BATCH_SIZE
      for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(texts.length / BATCH_SIZE);
        process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${batch.length} strings)...`);

        let translated;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            translated = await translateBatch(batch, deepl);
            break;
          } catch (err) {
            if (attempt < 2) {
              process.stdout.write(` retry ${attempt + 1}...`);
              await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
            } else {
              throw err;
            }
          }
        }
        allTranslated.push(...translated);
        console.log(` ✓`);

        // Delay between batches to avoid rate limits
        if (i + BATCH_SIZE < texts.length) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      if (allTranslated.length !== flat.length) {
        console.error(`  ⚠ Expected ${flat.length} strings, got ${allTranslated.length}`);
      }

      const entries = flat.map((e, i) => ({
        path: e.path,
        value: i < allTranslated.length ? allTranslated[i] : e.value
      }));

      const result = unflattenObject(entries);
      fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
      console.log(`✓ Saved ${code}.json (${allTranslated.length} strings)`);

      // Delay between languages
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error(`✗ Failed ${code}: ${err.message}`);
    }
  }

  console.log('\n✅ Done');
}

main().catch(console.error);
