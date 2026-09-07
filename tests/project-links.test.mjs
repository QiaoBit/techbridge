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
  assert.match(html, /"position": 3, "name": "旷野 Wayfar", "url": "https:\/\/wayfar\.qianx\.ai\/"/);
  assert.match(html, /"position": 4, "name": "如果世界", "url": "https:\/\/if\.qianx\.ai\/"/);
  assert.match(html, /展开全部 13 个产品/);
  assert.match(llms, /\[旷野 Wayfar\]\(https:\/\/wayfar\.qianx\.ai\/\)/);
  assert.match(llms, /\[如果世界\]\(https:\/\/if\.qianx\.ai\/\)/);
});
