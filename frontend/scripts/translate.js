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

async function translate(text, targetLang) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      text: [text],
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
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.translations && parsed.translations[0]) {
            resolve(parsed.translations[0].text);
          } else {
            reject(new Error(`Unexpected response: ${data}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function translateObject(obj, targetLang) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object') {
      result[key] = await translateObject(value, targetLang);
    } else {
      // Protect {variables} from translation
      const protected_text = value.replace(/\{(\w+)\}/g, '<var>$1</var>');
      const translated = await translate(protected_text, targetLang);
      // Restore variables
      result[key] = translated.replace(/<var>(\w+)<\/var>/g, '{$1}');
      console.log(`  ${key}: ${result[key]}`);
    }
  }
  return result;
}

async function main() {
  if (!DEEPL_API_KEY) {
    console.error('DEEPL_API_KEY not set');
    process.exit(1);
  }

  const en = JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, 'en.json'), 'utf8'));

  for (const { code, deepl } of TARGETS) {
    const outPath = path.join(MESSAGES_DIR, `${code}.json`);

    // Skip if already translated (re-run safe)
    if (fs.existsSync(outPath)) {
      const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      if (JSON.stringify(existing) !== JSON.stringify(en)) {
        console.log(`\n✓ ${code}.json already translated — skipping`);
        continue;
      }
    }

    console.log(`\nTranslating → ${deepl}...`);
    const translated = await translateObject(en, deepl);
    fs.writeFileSync(outPath, JSON.stringify(translated, null, 2));
    console.log(`✓ Saved ${code}.json`);
  }

  console.log('\n✅ All translations complete');
}

main().catch(console.error);
