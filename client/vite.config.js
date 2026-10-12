import { defineConfig } from 'vite';

// 仅本地开发使用的同源转发。部署纯静态文件时改用 direct 模式；
// 若线上浏览器跨域受限，由部署平台在 /music-api/ 配同源反代即可，无需额外业务后端。
export default defineConfig({
  // Absolute asset paths keep JS/CSS working on /music/song/... deep links.
  base: '/',
  server: {
    port: 3200,
    proxy: {
      '/music-api': {
        target: process.env.MUSIC_API_TARGET || 'https://music.20110208.xyz',
        changeOrigin: true,
        secure: true,
        rewrite: path => path.replace(/^\/music-api/, ''),
      },
    },
  },
});
