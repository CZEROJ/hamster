import { defineConfig } from 'vite';

export default defineConfig({
  // 모든 경로를 상대경로로 뽑는다.
  // 기본값(/)이면 빌드본이 사이트 최상단에만 올라간다.
  // github.io/hamster/ 같은 하위 주소에 올리면 전부 404가 난다.
  // './'면 어디에 올려도 그대로 돌아간다 — 친구한테 링크 주는 게 목적이니 이게 맞다.
  base: './',

  // 부팅할 때 IndexedDB를 먼저 읽어야 해서 top-level await를 쓴다.
  // (localStorage만 읽고 시작하면 복구본을 못 보고 짧은 로그로 시작해버린다)
  build: { target: 'es2022' },
  esbuild: { target: 'es2022' },
});
