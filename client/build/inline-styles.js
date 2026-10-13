// Keep first-paint styles in the HTML so a failed or stale asset request cannot
// leave a working music player rendered with browser-default controls.
export function inlineStyles() {
  return {
    name: 'aimo-inline-styles',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const entry of Object.values(bundle)) {
        if (entry.type !== 'asset' || !entry.fileName.endsWith('.html')) continue;
        entry.source = String(entry.source).replace(/<link\b[^>]*>/g, tag => {
          if (!/rel=["']stylesheet["']/.test(tag)) return tag;
          const href = tag.match(/href=["']([^"']+)["']/)?.[1];
          const asset = bundle[href?.replace(/^\//, '')];
          if (!asset || asset.type !== 'asset') throw Error(`样式构建产物缺失：${href}`);
          return `<style data-aimo-styles>${String(asset.source).replace(/<\/style/gi, '<\\/style')}</style>`;
        });
      }
    },
  };
}
