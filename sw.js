const SURUM = "manset-v1";
const KABUK = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
  "./config.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (olay) => {
  olay.waitUntil(caches.open(SURUM).then((c) => c.addAll(KABUK)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (olay) => {
  olay.waitUntil(
    caches
      .keys()
      .then((adlar) => Promise.all(adlar.filter((a) => a !== SURUM).map((a) => caches.delete(a))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (olay) => {
  const istek = olay.request;
  const adres = new URL(istek.url);
  if (istek.method !== "GET" || adres.origin !== self.location.origin) return; // görsellere karışma

  if (adres.pathname.endsWith("/data.json")) {
    // Önce ağ; olmazsa son kayıt.
    olay.respondWith(
      fetch(istek)
        .then((yanit) => {
          if (yanit.ok) {
            const kopya = yanit.clone();
            caches.open(SURUM).then((c) => c.put("./data.json", kopya));
          }
          return yanit;
        })
        .catch(() => caches.match("./data.json"))
    );
    return;
  }

  // Kabuk: önbellekten hemen ver, arkada tazele.
  olay.respondWith(
    caches.match(istek, { ignoreSearch: true }).then((kayitli) => {
      const taze = fetch(istek)
        .then((yanit) => {
          if (yanit.ok) {
            const kopya = yanit.clone();
            caches.open(SURUM).then((c) => c.put(istek, kopya));
          }
          return yanit;
        })
        .catch(() => kayitli);
      return kayitli || taze;
    })
  );
});

self.addEventListener("push", (olay) => {
  let yuk = {};
  try {
    yuk = olay.data ? olay.data.json() : {};
  } catch {}
  olay.waitUntil(
    self.registration.showNotification(yuk.title || "Gazete manşetleri hazır", {
      body: yuk.body || "Bugünün birinci sayfalarına bak",
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      tag: "sabah",
      data: { url: yuk.url || "./" },
    })
  );
});

self.addEventListener("notificationclick", (olay) => {
  olay.notification.close();
  const hedef = new URL(olay.notification.data?.url || "./", self.registration.scope).href;
  olay.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((pencereler) => {
      const acik = pencereler.find((p) => p.url.startsWith(self.registration.scope));
      return acik ? acik.focus() : self.clients.openWindow(hedef);
    })
  );
});
