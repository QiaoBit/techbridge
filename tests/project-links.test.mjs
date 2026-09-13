import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const llms = fs.readFileSync(new URL('../llms.txt', import.meta.url), 'utf8');

test('shows Wayfar and If World as linked product cards', () => {
  assert.match(html, /class="project-card project-card-wayfar reveal" href="https:\/\/wayfar\.qianx\.ai\/"/);
  assert.match(html, /class="project-card project-card-if-world reveal" href="https:\/\/if\.qianx\.ai\/"/);
  assert.match(html, /src="project-wayfar\.webp"/);
  assert.match(html, /src="project-if-world\.webp"/);
});

test('keeps the product schema and visible count aligned at thirteen', () => {
  assert.match(html, /"position": 7, "name": "旷野 Wayfar", "url": "https:\/\/wayfar\.qianx\.ai\/"/);
  assert.match(html, /"position": 9, "name": "如果世界", "url": "https:\/\/if\.qianx\.ai\/"/);
  assert.match(html, /展开全部 13 个产品/);
  assert.match(llms, /\[旷野 Wayfar\]\(https:\/\/wayfar\.qianx\.ai\/\)/);
  assert.match(llms, /\[如果世界\]\(https:\/\/if\.qianx\.ai\/\)/);
});

test('adds the exact GamsGo referral separately from self-created products', () => {
  assert.match(html, /class="project-card project-card-gamsgo reveal" href="https:\/\/www\.gamsgo\.com\/showcase\/r2hv89ec" target="_blank" rel="sponsored noopener noreferrer"/);
  assert.match(html, /展开全部 13 个产品与 1 个第三方入口/);
  assert.match(html, /非本站自营或 OpenAI 官方销售渠道/);
  const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const products = schema['@graph'].find(item => item['@id'] === 'https://qiaobit.com/#projects');
  assert.equal(products.itemListElement.length, 13);
  assert(!products.itemListElement.some(item => item.url?.includes('gamsgo.com')));
  assert.match(llms, /https:\/\/www\.gamsgo\.com\/showcase\/r2hv89ec/);
});

test('includes Qijian with its real workspace image and preview status', () => {
  assert.match(html, /class="project-card project-card-qijian reveal" href="https:\/\/qj\.qianx\.ai\/"/);
  assert.match(html, /src="https:\/\/qj\.qianx\.ai\/assets\/workspace\.png"/);
  assert.match(html, /"position": 4, "name": "齐件", "url": "https:\/\/qj\.qianx\.ai\/"/);
  assert.doesNotMatch(html, /有问必显/);
  assert.match(llms, /\[齐件\]\(https:\/\/qj\.qianx\.ai\/\)/);
});

test('replaces retired Creator Studio with the public Rongyifa store listing', () => {
  assert.doesNotMatch(html, /Creator Studio|creator-studio|chrome-extension:\/\//);
  assert.match(html, /class="project-card project-card-rongyifa reveal" href="https:\/\/chromewebstore\.google\.com\/detail\/apcjmmalmljfbaicddioflcmaibjjkpp"/);
  assert.match(html, /前往 Chrome 商店/);
  assert.match(llms, /\[容易发\]\(https:\/\/chromewebstore\.google\.com\/detail\/apcjmmalmljfbaicddioflcmaibjjkpp\)/);
});

test('packs the portfolio into full-width ends and six pairs without a lone cell', () => {
  const grid = html.split('<div class="projects-grid">')[1].split('<button class="projects-toggle"')[0];
  const cards = [...grid.matchAll(/class="(project-card\s[^"]*)"/g)].map(match => match[1]);
  assert.equal(cards.length, 14);
  assert.match(cards[0], /project-card-featured/);
  assert.match(cards.at(-1), /project-card-wide project-card-static/);
  assert.match(cards[4], /project-card-qijian/);
  assert(cards.slice(1, 13).every(classes => !classes.includes('project-card-wide')));
  assert.match(cards[13], /project-card-wide/);
});

test('prioritizes purchase-ready entries and keeps non-paid projects together below', () => {
  const grid = html.split('<div class="projects-grid">')[1].split('<button class="projects-toggle"')[0];
  const names = [...grid.matchAll(/class="project-name">([^<]+)/g)].map(match => match[1]);
  assert.deepEqual(names, ['硅基物语', 'AI Skills 年度买手服务', 'ChatGPT 订阅购买 · GamsGo', '择偶定位', '齐件', '容易发', '电商AI素材通', '旷野 Wayfar', 'Kairos', '如果世界', '虚拟偶像 林雪妮', '超模算力', 'Novart', '地球 Online']);
  const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const items = schema['@graph'].find(item => item['@id'] === 'https://qiaobit.com/#projects').itemListElement;
  assert.deepEqual(items.map(item => item.name), names.filter(name => !name.includes('GamsGo')));
  assert.deepEqual(items.map(item => item.position), items.map((_, i) => i + 1));
});
