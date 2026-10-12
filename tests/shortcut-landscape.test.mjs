import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../client/src/ui/keyboard.css',import.meta.url),'utf8');
test('手机横屏即使超过 767 CSS 像素也不会出现桌面快捷键表单',()=>{
 assert.match(css,/@media\s*\(hover:\s*none\)\s*and\s*\(pointer:\s*coarse\)\s*and\s*\(max-width:\s*1000px\)/);
 assert.match(css,/\/\* Include landscape phones[^*]*\*\/\s*\.desktop-shortcuts-section\s*\{\s*display:\s*none\s*!important/);
});
