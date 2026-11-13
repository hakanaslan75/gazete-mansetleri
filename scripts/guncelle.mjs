// gazeteoku.com'daki birinci sayfa görsellerinin adreslerini data.json'a yazar.
// Node 20+, bağımlılık yok. Kullanım: node scripts/guncelle.mjs
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const KAYNAK = "https://www.gazeteoku.com/gazeteler";
const CIKTI = fileURLToPath(new URL("../data.json", import.meta.url));
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const VARLIKLAR = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", uuml: "ü", Uuml: "Ü", ouml: "ö", Ouml: "Ö", ccedil: "ç", Ccedil: "Ç" };
function coz(metin) {
  return metin
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (tam, ad) => VARLIKLAR[ad] ?? tam);
}

export function ayikla(html) {
  const gazeteler = [];
  const gorulen = new Set();
  const baglanti = /<a href="https:\/\/www\.gazeteoku\.com\/gazeteler\/([a-z0-9-]+)" title="([^"]+)"/g;
  let m;
  while ((m = baglanti.exec(html))) {
    const id = m[1].replace(/(-gazetesi)+-manseti$/, "").replace(/-manseti$/, "");
    if (gorulen.has(id)) continue;
    // Bu bağlantıdan sonraki ilk görsel, bir sonraki gazeteye taşmadan.
    const dilim = html.slice(m.index, m.index + 2500);
    const g = /data-src="https:\/\/i\.gazeteoku\.com\/[^"]*?(storage\/files\/images\/(\d{4})\/(\d{2})\/(\d{2})\/[^"]+?\.(?:jpe?g|png|webp))"/.exec(dilim);
    if (!g) continue;
    gorulen.add(id);
    gazeteler.push({
      id,
      ad: coz(m[2]).replace(/\s+Gazetesi$/i, "").trim(),
      tarih: `${g[2]}-${g[3]}-${g[4]}`,
      kucuk: `https://i.gazeteoku.com/3/460/772/${g[1]}`,
      buyuk: `https://i.gazeteoku.com/${g[1]}`,
    });
  }
  return gazeteler;
}

async function calistir() {
  const yanit = await fetch(KAYNAK, { headers: { "User-Agent": UA, "Accept-Language": "tr-TR,tr;q=0.9" } });
  if (!yanit.ok) throw new Error(`Kaynak ${yanit.status} döndü`);
  const gazeteler = ayikla(await yanit.text());
  if (gazeteler.length < 10) throw new Error(`Yalnız ${gazeteler.length} gazete bulundu; sayfa yapısı değişmiş olabilir`);

  let eski = null;
  try {
    eski = JSON.parse(await readFile(CIKTI, "utf8"));
  } catch {}
  if (eski && JSON.stringify(eski.gazeteler) === JSON.stringify(gazeteler)) {
    console.log(`Değişiklik yok (${gazeteler.length} gazete)`);
    return;
  }
  await writeFile(CIKTI, JSON.stringify({ guncelleme: new Date().toISOString(), gazeteler }, null, 1) + "\n");
  console.log(`data.json yazıldı: ${gazeteler.length} gazete, ilk tarih ${gazeteler[0].tarih}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  calistir().catch((hata) => {
    console.error("HATA:", hata.message);
    process.exit(1);
  });
}
