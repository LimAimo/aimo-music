import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const main=file('client/src/main.js'),render=file('client/src/ui/render.js'),css=file('client/src/ui/share.css'),share=file('client/src/ui/share.js'),vite=file('client/vite.config.js'),redirect=file('client/public/_redirects');
test('已移除面包屑目录入口，保留真实 URL 路由',()=>{
 assert.doesNotMatch(main,/import.*navigation-view\.js/);
 assert.doesNotMatch(main,/directoryMarkup\(state\)/);
 assert.match(main,/routeUrl\(/);
 assert.match(main,/parseRoute\(/);
});
test('歌曲、歌词、歌单和历史统计均有分享入口',()=>{
 for(const action of ['share-current','share-playlist','share-lyrics','share-stats'])assert.match(render,new RegExp('data-action="'+action+'"'));
 assert.match(file('client/src/ui/collections-view.js'),/menuButton\('share'/);
});
test('卡片编辑器及移动端均有主题样式',()=>{
 for(const selector of ['.share-modal-backdrop','.share-modal-body','.share-control-row','.share-fields','.share-card','.share-modal-actions','.share-btn','.share-public-page','.share-lyric-pick'])assert.ok(css.includes(selector),selector);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/focus-visible/);
});
test('分享链接不依赖数据库，发布前确认',()=>{
 assert.match(main,/confirmPublish:async/);
 assert.match(share,/confirmPublish\(draft\)/);
 assert.match(share,/canvas\.toBlob\(resolve,'image\/png'\)/);
});
test('Cloudflare 直接访问和刷新不会丢失静态资源',()=>{
 assert.match(vite,/base: '\/'/);
 assert.match(redirect,/\/music\/\* \/index\.html 200/);
});
