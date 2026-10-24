// 오프라인용: 처음 한 번 열면 앱과 교과서 페이지를 전부 저장해 둠
// 내용(data.js·app.js·이미지)을 바꾸면 VERSION 숫자를 올려야 폰에 새 버전이 받아짐
const VERSION = 'v3';
const SHELL = ["./", "index.html", "app.css", "data.js", "app.js", "vendor/react.js", "vendor/react-dom.js", "vendor/htm.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png"];
const PAGES = ["p/076.jpg", "p/077.jpg", "p/078.jpg", "p/079.jpg", "p/080.jpg", "p/081.jpg", "p/082.jpg", "p/083.jpg", "p/084.jpg", "p/085.jpg", "p/086.jpg", "p/087.jpg", "p/088.jpg", "p/089.jpg", "p/090.jpg", "p/091.jpg", "p/092.jpg", "p/093.jpg", "p/094.jpg", "p/095.jpg", "p/096.jpg", "p/097.jpg", "p/098.jpg", "p/099.jpg", "p/100.jpg", "p/101.jpg", "p/102.jpg", "p/103.jpg", "p/104.jpg", "p/105.jpg", "p/106.jpg", "p/107.jpg", "p/108.jpg", "p/109.jpg", "p/110.jpg", "p/111.jpg", "p/112.jpg", "p/113.jpg", "p/114.jpg", "p/115.jpg", "p/116.jpg", "p/117.jpg", "p/118.jpg", "p/119.jpg", "p/120.jpg", "p/121.jpg", "p/122.jpg", "p/123.jpg", "p/128.jpg", "p/129.jpg", "p/130.jpg", "p/131.jpg", "p/132.jpg", "p/133.jpg", "p/134.jpg", "p/135.jpg", "p/136.jpg", "p/137.jpg", "p/138.jpg", "p/139.jpg", "p/140.jpg", "p/141.jpg", "p/142.jpg", "p/143.jpg", "p/144.jpg", "p/145.jpg", "p/146.jpg", "p/147.jpg", "p/148.jpg", "p/149.jpg", "p/150.jpg", "p/151.jpg"];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL).then(() => c.addAll(PAGES).catch(() => {}))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
    return res;
  })));
});
