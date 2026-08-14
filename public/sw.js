/**
 * 서비스워커 — 파일을 폰에 담아두는 일만 한다.
 *
 * ★ 이 게임은 서버가 없다. 세이브도 전부 브라우저 안(IndexedDB)에 있다.
 *   그래서 파일 몇 개만 담아두면 **비행기 모드에서도 그대로 돌아간다.**
 *   서버가 없는 게 여기서 이득으로 돌아온다.
 *
 * ★ 캐시 우선이 아니라 '네트워크 먼저, 실패하면 캐시'다.
 *
 *   캐시 우선이 빠르지만, 그러면 게임을 고쳐서 올려도 친구 폰에는 옛날 게
 *   계속 뜬다. 어디가 잘못됐는지 알 수 없는 종류의 문제라 제일 나쁘다.
 *   이 게임은 50KB짜리라 네트워크를 먼저 봐도 체감이 없다.
 */
const CACHE = 'hamster-v1';

// 껍데기만 미리 담는다. 나머지는 처음 받을 때 담긴다.
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        // 받아온 건 조용히 담아둔다 — 다음에 오프라인이어도 되도록
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => {
          if (hit) return hit;
          // 새 주소를 오프라인에서 열었을 때: 첫 페이지라도 돌려준다
          if (req.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        }),
      ),
  );
});
