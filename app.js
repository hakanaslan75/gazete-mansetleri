(() => {
  "use strict";

  const VARSAYILAN = ["hurriyet", "sabah", "sozcu", "milliyet", "cumhuriyet", "posta", "turkiye", "karar", "aksam", "yeni-safak", "birgun", "nefes", "fanatik", "fotomac"];
  const TAZELIK_MS = 10 * 60 * 1000;
  const $ = (id) => document.getElementById(id);

  const depo = {
    al(anahtar, yoksa) {
      try {
        const v = localStorage.getItem(anahtar);
        return v === null ? yoksa : JSON.parse(v);
      } catch {
        return yoksa;
      }
    },
    yaz(anahtar, deger) {
      try {
        localStorage.setItem(anahtar, JSON.stringify(deger));
      } catch {}
    },
  };

  let veri = depo.al("veri", null);
  let secili = new Set(depo.al("secili", VARSAYILAN));
  let sonCekim = 0;
  let gorunen = [];

  /* ---------- Tarih ---------- */
  const istanbulGun = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(d);
  const uzunTarih = (d = new Date()) =>
    new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "long", year: "numeric", weekday: "long" }).format(d);
  function gunEtiketi(tarih) {
    const bugun = istanbulGun();
    if (tarih === bugun) return "";
    if (tarih === istanbulGun(new Date(Date.now() - 864e5))) return "dünkü";
    const [, ay, gun] = tarih.split("-");
    return `${Number(gun)}.${ay}`;
  }

  /* ---------- Veri ---------- */
  function sirala(gazeteler) {
    const sira = (g) => {
      const i = VARSAYILAN.indexOf(g.id);
      return i === -1 ? 1000 : i;
    };
    return gazeteler.map((g, i) => [g, i]).sort((a, b) => sira(a[0]) - sira(b[0]) || a[1] - b[1]).map((x) => x[0]);
  }

  async function cek(zorla) {
    if (!zorla && Date.now() - sonCekim < TAZELIK_MS) return;
    $("yenile").classList.add("donuyor");
    try {
      const yanit = await fetch(`./data.json?t=${Date.now()}`, { cache: "no-store" });
      if (!yanit.ok) throw new Error(String(yanit.status));
      const yeni = await yanit.json();
      if (!Array.isArray(yeni.gazeteler)) throw new Error("biçim");
      veri = yeni;
      sonCekim = Date.now();
      depo.yaz("veri", veri);
      notGoster("");
    } catch {
      notGoster(veri ? `Çevrimdışı. Son güncelleme: ${zamanYaz(veri.guncelleme)}` : "Manşetler yüklenemedi. Bağlantını kontrol edip yenile.");
    } finally {
      $("yenile").classList.remove("donuyor");
      ciz();
    }
  }

  function zamanYaz(iso) {
    try {
      return new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
    } catch {
      return "";
    }
  }
  function notGoster(metin) {
    $("not").textContent = metin;
    $("not").hidden = !metin;
  }

  /* ---------- Izgara ---------- */
  function ciz() {
    $("tarih").textContent = uzunTarih();
    const izgara = $("izgara");
    const hepsi = veri ? sirala(veri.gazeteler) : [];
    gorunen = hepsi.filter((g) => secili.has(g.id));
    izgara.replaceChildren(
      ...gorunen.map((g, i) => {
        const kart = document.createElement("button");
        kart.className = "kart";
        kart.type = "button";
        kart.setAttribute("aria-label", `${g.ad} birinci sayfası`);
        const sayfa = document.createElement("div");
        sayfa.className = "sayfa";
        const img = document.createElement("img");
        img.alt = "";
        img.decoding = "async";
        if (i > 3) img.loading = "lazy";
        img.onload = () => img.classList.add("geldi");
        img.onerror = () => {
          const h = document.createElement("div");
          h.className = "hata";
          h.textContent = "Görsel açılamadı";
          img.replaceWith(h);
        };
        img.src = g.kucuk;
        sayfa.append(img);
        const ad = document.createElement("div");
        ad.className = "ad";
        const adYazi = document.createElement("span");
        adYazi.textContent = g.ad;
        ad.append(adYazi);
        const et = gunEtiketi(g.tarih);
        if (et) {
          const e = document.createElement("span");
          e.className = "etiket";
          e.textContent = et;
          ad.append(e);
        }
        kart.append(sayfa, ad);
        kart.addEventListener("click", () => bakici.ac(i));
        return kart;
      })
    );
    $("bos").hidden = !veri || gorunen.length > 0;
    $("sonGuncelleme").textContent = veri ? `Son güncelleme: ${zamanYaz(veri.guncelleme)} · Kaynak: gazeteoku.com` : "";
    listeCiz(hepsi);
  }

  /* ---------- Görüntüleyici ---------- */
  const bakici = (() => {
    const kok = $("bakici"), sahne = $("sahne"), img = $("bakiciGorsel");
    let sira = 0, olcek = 1, tx = 0, ty = 0;
    let jest = null, sonDokunus = 0, sonNokta = null, yukSira = 0;

    function uygula(yumusak) {
      img.classList.toggle("yumusak", !!yumusak);
      img.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${olcek})`;
      kok.classList.toggle("yakin", olcek > 1.02);
    }
    function sinirla() {
      const mx = Math.max(0, (img.offsetWidth * olcek - sahne.clientWidth) / 2);
      const my = Math.max(0, (img.offsetHeight * olcek - sahne.clientHeight) / 2);
      tx = Math.min(mx, Math.max(-mx, tx));
      ty = Math.min(my, Math.max(-my, ty));
    }
    function sifirla(yumusak) {
      olcek = 1; tx = 0; ty = 0;
      img.style.opacity = "";
      uygula(yumusak);
    }
    // (x, y): sahne merkezine göre nokta. O nokta yerinde kalacak şekilde ölçekle.
    function olcekle(yeni, x, y) {
      yeni = Math.min(6, Math.max(1, yeni));
      const k = yeni / olcek;
      tx = x - (x - tx) * k;
      ty = y - (y - ty) * k;
      olcek = yeni;
      if (olcek === 1) { tx = 0; ty = 0; }
      sinirla();
    }
    const merkezeGore = (cx, cy) => {
      const r = sahne.getBoundingClientRect();
      return [cx - r.left - r.width / 2, cy - r.top - r.height / 2];
    };

    function goster(i) {
      sira = (i + gorunen.length) % gorunen.length;
      const g = gorunen[sira];
      const benim = ++yukSira;
      $("bakiciAd").textContent = g.ad;
      $("bakiciSayac").textContent = `${sira + 1} / ${gorunen.length}`;
      img.alt = `${g.ad} birinci sayfası`;
      sifirla(false);
      img.src = g.kucuk;
      const buyuk = new Image();
      buyuk.onload = () => { if (benim === yukSira && !kok.hidden) img.src = g.buyuk; };
      buyuk.src = g.buyuk;
      // Komşuları önden ısıt.
      [1, -1].forEach((d) => { const k = gorunen[(sira + d + gorunen.length) % gorunen.length]; if (k) new Image().src = k.kucuk; });
    }
    function ac(i) {
      if (!gorunen.length) return;
      kok.hidden = false;
      document.body.classList.add("kilit");
      goster(i);
    }
    function kapat() {
      kok.hidden = true;
      yukSira++;
      document.body.classList.remove("kilit");
      img.removeAttribute("src");
    }
    const kaydir = (d) => goster(sira + d);

    const mesafe = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    sahne.addEventListener("touchstart", (e) => {
      e.preventDefault();
      img.classList.remove("yumusak");
      if (e.touches.length >= 2) {
        const [a, b] = e.touches;
        jest = { tur: "cimdik", d0: mesafe(a, b), o0: olcek };
      } else {
        const t = e.touches[0];
        jest = { tur: olcek > 1.02 ? "gez" : "kaydir", x0: t.clientX, y0: t.clientY, tx0: tx, ty0: ty, dx: 0, dy: 0, t0: Date.now() };
      }
    }, { passive: false });

    sahne.addEventListener("touchmove", (e) => {
      e.preventDefault();
      if (!jest) return;
      if (jest.tur === "cimdik" && e.touches.length >= 2) {
        const [a, b] = e.touches;
        const [mx, my] = merkezeGore((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
        olcekle(jest.o0 * (mesafe(a, b) / jest.d0), mx, my);
        uygula(false);
      } else if (jest.tur === "gez") {
        const t = e.touches[0];
        tx = jest.tx0 + (t.clientX - jest.x0);
        ty = jest.ty0 + (t.clientY - jest.y0);
        sinirla();
        uygula(false);
      } else if (jest.tur === "kaydir") {
        const t = e.touches[0];
        jest.dx = t.clientX - jest.x0;
        jest.dy = t.clientY - jest.y0;
        if (!jest.eksen && Math.hypot(jest.dx, jest.dy) > 10) jest.eksen = Math.abs(jest.dx) > Math.abs(jest.dy) ? "x" : "y";
        if (jest.eksen === "x") { tx = jest.dx; ty = 0; }
        else if (jest.eksen === "y") { tx = 0; ty = Math.max(0, jest.dy); img.style.opacity = String(Math.max(0.3, 1 - ty / 400)); }
        uygula(false);
      }
    }, { passive: false });

    sahne.addEventListener("touchend", (e) => {
      e.preventDefault();
      if (!jest) return;
      if (e.touches.length > 0) {
        // Çimdikten tek parmağa düştü: gezmeye devam.
        const t = e.touches[0];
        jest = { tur: olcek > 1.02 ? "gez" : "bekle", x0: t.clientX, y0: t.clientY, tx0: tx, ty0: ty, dx: 0, dy: 0, t0: 0 };
        return;
      }
      const j = jest;
      jest = null;
      if (j.tur === "cimdik" || j.tur === "bekle") {
        if (olcek < 1.05) sifirla(true);
        return;
      }
      const t = e.changedTouches[0];
      const kisa = Date.now() - j.t0 < 280 && Math.hypot(t.clientX - j.x0, t.clientY - j.y0) < 12;
      if (kisa) {
        const simdi = Date.now();
        if (simdi - sonDokunus < 320 && sonNokta && Math.hypot(t.clientX - sonNokta[0], t.clientY - sonNokta[1]) < 40) {
          sonDokunus = 0;
          if (olcek > 1.02) sifirla(true);
          else { const [x, y] = merkezeGore(t.clientX, t.clientY); olcekle(2.6, x, y); uygula(true); }
        } else {
          sonDokunus = simdi;
          sonNokta = [t.clientX, t.clientY];
        }
        if (j.tur === "kaydir") { tx = 0; ty = 0; uygula(true); }
        return;
      }
      if (j.tur === "kaydir") {
        if (j.eksen === "x" && Math.abs(j.dx) > 60) return kaydir(j.dx < 0 ? 1 : -1);
        if (j.eksen === "y" && j.dy > 110) return kapat();
        sifirla(true);
      }
    }, { passive: false });
    sahne.addEventListener("touchcancel", () => { jest = null; sifirla(true); });

    // Masaüstü: tekerlek, çift tık, sürükleme, klavye.
    sahne.addEventListener("wheel", (e) => {
      e.preventDefault();
      const [x, y] = merkezeGore(e.clientX, e.clientY);
      olcekle(olcek * (e.deltaY < 0 ? 1.2 : 1 / 1.2), x, y);
      uygula(false);
    }, { passive: false });
    sahne.addEventListener("dblclick", (e) => {
      if (olcek > 1.02) return sifirla(true);
      const [x, y] = merkezeGore(e.clientX, e.clientY);
      olcekle(2.6, x, y);
      uygula(true);
    });
    let fare = null;
    sahne.addEventListener("mousedown", (e) => { if (olcek > 1.02) fare = { x0: e.clientX, y0: e.clientY, tx0: tx, ty0: ty }; });
    window.addEventListener("mousemove", (e) => {
      if (!fare) return;
      tx = fare.tx0 + e.clientX - fare.x0;
      ty = fare.ty0 + e.clientY - fare.y0;
      sinirla();
      uygula(false);
    });
    window.addEventListener("mouseup", () => { fare = null; });
    document.addEventListener("keydown", (e) => {
      if (kok.hidden) return;
      if (e.key === "Escape") kapat();
      else if (e.key === "ArrowRight") kaydir(1);
      else if (e.key === "ArrowLeft") kaydir(-1);
    });
    $("bakiciKapat").addEventListener("click", kapat);
    $("onceki").addEventListener("click", () => kaydir(-1));
    $("sonraki").addEventListener("click", () => kaydir(1));
    window.addEventListener("resize", () => { if (!kok.hidden) { sinirla(); uygula(false); } });

    return { ac, kapat };
  })();

  /* ---------- Ayarlar ---------- */
  function listeCiz(hepsi) {
    $("gazeteListe").replaceChildren(
      ...hepsi.map((g) => {
        const li = document.createElement("li");
        const label = document.createElement("label");
        const ad = document.createElement("span");
        ad.textContent = g.ad;
        const kutu = document.createElement("input");
        kutu.type = "checkbox";
        kutu.checked = secili.has(g.id);
        kutu.addEventListener("change", () => {
          kutu.checked ? secili.add(g.id) : secili.delete(g.id);
          depo.yaz("secili", [...secili]);
          ayarDegisti = true;
        });
        label.append(ad, kutu);
        li.append(label);
        return li;
      })
    );
  }
  let ayarDegisti = false;
  function ayarAc() {
    $("perde").hidden = false;
    $("ayarlar").hidden = false;
    document.body.classList.add("kilit");
    bildirimDurumu();
  }
  function ayarKapat() {
    $("perde").hidden = true;
    $("ayarlar").hidden = true;
    document.body.classList.remove("kilit");
    if (ayarDegisti) { ayarDegisti = false; ciz(); }
  }
  $("ayarAc").addEventListener("click", ayarAc);
  $("ayarKapat").addEventListener("click", ayarKapat);
  $("perde").addEventListener("click", ayarKapat);
  $("yenile").addEventListener("click", () => cek(true));

  /* ---------- Bildirim ---------- */
  const kurulu = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  function anahtarCevir(b64) {
    const dolgu = "=".repeat((4 - (b64.length % 4)) % 4);
    const ham = atob((b64 + dolgu).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(ham, (c) => c.charCodeAt(0));
  }
  function abonelikGoster(abonelik) {
    $("abonelikMetin").value = JSON.stringify(abonelik);
    $("abonelikKutu").hidden = false;
    $("bildirimAc").hidden = true;
    $("bildirimDurum").textContent = "Bildirimler bu cihazda açık.";
  }
  async function bildirimDurumu() {
    const durum = $("bildirimDurum"), dugme = $("bildirimAc");
    $("abonelikKutu").hidden = true;
    dugme.hidden = false;
    dugme.disabled = true;
    if (iOS && !kurulu()) {
      durum.textContent = "iPhone'da bildirim yalnız ana ekrana eklenmiş uygulamada çalışır. Önce Safari'de Paylaş › Ana Ekrana Ekle ile kur, sonra uygulamayı oradan aç.";
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      durum.textContent = "Bu tarayıcı bildirimi desteklemiyor.";
      return;
    }
    if (Notification.permission === "denied") {
      durum.textContent = "Bildirim izni kapalı. Telefonun Ayarlar › Bildirimler bölümünden bu uygulamaya izin ver.";
      return;
    }
    try {
      const kayit = await navigator.serviceWorker.ready;
      const abonelik = await kayit.pushManager.getSubscription();
      if (abonelik) return abonelikGoster(abonelik);
    } catch {}
    durum.textContent = "Her sabah 9'a doğru günün birinci sayfaları hazır olunca haber verir.";
    dugme.disabled = false;
  }
  $("bildirimAc").addEventListener("click", async () => {
    const durum = $("bildirimDurum");
    try {
      const izin = await Notification.requestPermission();
      if (izin !== "granted") { durum.textContent = "İzin verilmedi."; return; }
      const kayit = await navigator.serviceWorker.ready;
      const abonelik = await kayit.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: anahtarCevir(window.AYAR.vapidPublic) });
      abonelikGoster(abonelik);
    } catch (e) {
      durum.textContent = `Bildirim açılamadı: ${e.message || e}`;
    }
  });
  $("abonelikKopyala").addEventListener("click", async () => {
    const kutu = $("abonelikMetin"), dugme = $("abonelikKopyala");
    try {
      await navigator.clipboard.writeText(kutu.value);
    } catch {
      kutu.select();
      document.execCommand("copy");
    }
    dugme.textContent = "Kopyalandı";
    setTimeout(() => (dugme.textContent = "Kopyala"), 1800);
  });

  /* ---------- Başlat ---------- */
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") cek(false); });
  ciz();
  cek(true);
})();
