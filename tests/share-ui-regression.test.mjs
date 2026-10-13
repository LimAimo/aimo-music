import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const main=file('client/src/main.js'),render=file('client/src/ui/render.js'),css=file('client/src/ui/share.css'),share=file('client/src/ui/share.js'),vite=file('client/vite.config.js'),redirect=file('client/public/_redirects');
test('已移除面包屑目录入口，保留真实 URL 路由',()=>{
 assert.doesNotMatch(main,/import.*navigation-view\.js/);
 assert.doesNotMatch(main,/directoryMarkup\(state\)/);
 assert.match(main,/routeUrl\(/);
 assert.match(main,/parseRoute\(/);
});
test('保留歌曲菜单、歌单与统计分享，完整播放器不再分享歌词',()=>{
 assert.match(main,/case 'share-current'/);
 assert.match(render,/data-action="share-playlist"/);
 assert.match(render,/data-action="share-stats"/);
 assert.match(file('client/src/ui/collections-view.js'),/menuButton\('share'/);
 assert.doesNotMatch(render,/data-action="share-lyrics"|data-action="lyric-select"|分享所选歌词/);
 assert.doesNotMatch(main,/case 'share-lyrics'|case 'lyric-select'|selectedLyrics/);
 assert.match(render,/data-action="seek-lyric"/);
});
test('只保留固定杂志海报的样式和操作',()=>{
 for(const selector of ['.share-modal-backdrop','.share-modal-body','.share-card','.share-card-art','.share-card--dense','.share-modal-actions','.share-btn','.share-public-page','.share-inline-confirm'])assert.ok(css.includes(selector),selector);
 assert.doesNotMatch(css,/share-card--vinyl|share-card--minimal|share-control-row|share-fields|share-lyric-pick/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/focus-visible/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(share,/share-card--poster/);
 assert.doesNotMatch(share,/AIMO MUSIC \/ SHARE|AIMO music \/|唱片模板|切换模板/);
});
test('分享链接不依赖数据库，发布前确认',()=>{
 assert.match(main,/confirmPublish:async/);
 assert.match(share,/data-share-confirm/);
 assert.match(share,/requestConfirm\(action\)/);
 assert.match(share,/navigator\.share\(/);
 assert.match(share,/canvas\.toBlob\(resolve,'image\/png'\)/);
});
test('Cloudflare 直接访问和刷新不会丢失静态资源',()=>{
 assert.match(vite,/base: '\/'/);
 assert.match(redirect,/\/music\/\* \/index\.html 200/);
});
