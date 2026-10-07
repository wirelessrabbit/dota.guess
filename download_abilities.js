const fs = require('fs');
const path = require('path');
const https = require('https');

const OUTPUT_DIR = path.join(__dirname, 'images', 'abilities');
const JSON_OUTPUT = path.join(__dirname, 'abilities_local.json');

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => file.close(resolve));
      } else {
        fs.unlink(dest, () => {});
        reject(`Failed to download ${url}: Status ${response.statusCode}`);
      }
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err.message);
    });
  });
}

async function run() {
  console.log('Fetching OpenDota API constants...');

  const heroesRes = await fetch('https://api.opendota.com/api/heroes');
  const heroes = await heroesRes.json();
  const heroMap = {};
  heroes.forEach(h => {
    const cleanKey = h.name.replace('npc_dota_hero_', '');
    heroMap[cleanKey] = h.localized_name;
  });

  const abilitiesRes = await fetch('https://api.opendota.com/api/constants/abilities');
  const abilities = await abilitiesRes.json();

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const compiledData = [];
  const entries = Object.entries(abilities);

  // Keywords that identify non-hero / special / creep abilities
  const specialKeywords = ['creep', 'neutral', 'roshan', 'courier', 'siege', 'tower', 'flagbearer', 'necronomicon', 'minion'];

  for (const [key, data] of entries) {
    if (!data.dname || !data.img || key.includes('generic_hidden') || key.includes('special_bonus')) {
      continue;
    }

    let matchedHero = null;
    for (const [heroKey, heroName] of Object.entries(heroMap)) {
      if (key.startsWith(heroKey + '_')) {
        matchedHero = heroName;
        break;
      }
    }

    // Determine category
    const isSpecialKeyword = specialKeywords.some(kw => key.includes(kw));
    const category = (matchedHero && !isSpecialKeyword) ? 'hero' : 'special';

    const imgFileName = `${key}.png`;
    const localImgPath = path.join(OUTPUT_DIR, imgFileName);
    const cdnUrl = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/${key}.png`;

    try {
      await downloadFile(cdnUrl, localImgPath);

      compiledData.push({
        key: key,
        ability: data.dname,
        hero: matchedHero || 'Creep / Neutral / Special',
        category: category, // 'hero' or 'special'
        iconUrl: `./images/abilities/${imgFileName}`
      });
      console.log(`[${category.toUpperCase()}] ${imgFileName}`);
    } catch (err) {
      // Skip if icon doesn't exist on CDN
    }
  }

  fs.writeFileSync(JSON_OUTPUT, JSON.stringify(compiledData, null, 2));
  console.log(`\nFinished! Processed ${compiledData.length} abilities.`);
}

run();
