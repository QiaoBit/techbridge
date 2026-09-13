import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('places public talk resources under press without changing the product catalogue', () => {
  const press = html.split('<section id="press"')[1].split('</section>')[0];
  assert.match(press, /演讲与资料/);
  assert.match(press, /href="https:\/\/ppt\.qianx\.ai\/" target="_blank" rel="noopener noreferrer"/);
  assert(press.indexOf('talks-resource') > press.indexOf('HICOOL 大会'));
  const grid = html.split('<div class="projects-grid">')[1].split('<button class="projects-toggle"')[0];
  assert.doesNotMatch(grid, /ppt\.qianx\.ai/);
  assert.match(html, /href="\/insights\/enterprise-ai-implementation"/);
});
