// Sabah bildirimini yollar. Ortam: VAPID_PUBLIC, VAPID_PRIVATE, PUSH_ABONELIK (nesne ya da dizi JSON).
import { readFile } from "node:fs/promises";

const ham = (process.env.PUSH_ABONELIK || "").trim();
if (!ham) {
  console.log("Abonelik yok, atlandı");
  process.exit(0);
}

let aboneler;
try {
  const veri = JSON.parse(ham);
  aboneler = Array.isArray(veri) ? veri : [veri];
} catch {
  console.error("PUSH_ABONELIK geçerli JSON değil");
  process.exit(1);
}

const { VAPID_PUBLIC, VAPID_PRIVATE } = process.env;
if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
  console.error("VAPID_PUBLIC ya da VAPID_PRIVATE eksik");
  process.exit(1);
}

let sayi = 0;
try {
  const veri = JSON.parse(await readFile(new URL("../data.json", import.meta.url), "utf8"));
  sayi = veri.gazeteler.length;
} catch {}

const gun = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "long", weekday: "long" }).format(new Date());
const yuk = JSON.stringify({
  title: "Gazete manşetleri hazır",
  body: sayi ? `${gun} · ${sayi} gazetenin birinci sayfası` : gun,
  url: "./",
});

const { default: webpush } = await import("web-push");
webpush.setVapidDetails(process.env.VAPID_KONU || "mailto:bildirim@example.com", VAPID_PUBLIC, VAPID_PRIVATE);

let hata = false;
for (const [i, abone] of aboneler.entries()) {
  try {
    const sonuc = await webpush.sendNotification(abone, yuk, { TTL: 6 * 3600, urgency: "high" });
    console.log(`Abone ${i + 1}: gönderildi (${sonuc.statusCode})`);
  } catch (e) {
    hata = true;
    console.error(`Abone ${i + 1}: gönderilemedi (${e.statusCode ?? "?"})${e.statusCode === 410 || e.statusCode === 404 ? " — abonelik geçersiz, uygulamadan yeniden alınmalı" : ""}`);
  }
}
process.exit(hata ? 1 : 0);
