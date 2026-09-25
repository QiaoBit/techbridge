import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('places the site tour film directly between the hero and the about section', () => {
  const hero = html.indexOf('<section id="hero"');
  const tour = html.indexOf('<section id="tour"');
  const about = html.indexOf('<section id="about"');
  assert(hero > -1 && tour > -1 && about > -1);
  assert(hero < tour && tour < about);
  const between = html.slice(html.indexOf('</section>', hero), about);
  assert.equal((between.match(/<section\b/g) || []).length, 1);
});

test('loads the site tour film only on demand, with a poster and both languages', () => {
  const tour = html.split('<section id="tour"')[1].split('</section>')[0];
  assert.match(tour, /<video[^>]*\bcontrols\b/);
  assert.match(tour, /<video[^>]*\bplaysinline\b/);
  assert.match(tour, /<video[^>]*preload="none"/);
  assert.match(tour, /<video[^>]*poster="poster-site-tour\.webp"/);
  assert.match(tour, /<source src="site-tour\.mp4" type="video\/mp4">/);
  assert.match(tour, /data-lang="zh"/);
  assert.match(tour, /data-lang="en"/);
});

test('moves the 44s interview film out of About and into the press section', () => {
  const about = html.split('<section id="about"')[1].split('</section>')[0];
  assert.doesNotMatch(about, /intro-video\.mp4/);
  const press = html.split('<section id="press"')[1].split('</section>')[0];
  const film = press.split('class="pudong-training press-film"')[1];
  assert(film, 'press film block is missing');
  assert.match(film, /<video[^>]*preload="none"[^>]*poster="poster-intro-video\.webp"/);
  assert.match(film, /<source src="intro-video\.mp4" type="video\/mp4">/);
  assert(press.indexOf('press-film') > press.indexOf('pudongTrainingTitle'));
  assert(press.indexOf('press-film') < press.indexOf('talks-resource'));
});

test('reports 100 served companies everywhere', () => {
  assert.doesNotMatch(html, /5500/);
  assert.match(html, /<span class="stat-accent">100\+<\/span>/);
  assert.match(html, /累计服务 100 家企业/);
});

test('ships the site tour video and poster files', () => {
  for (const file of ['site-tour.mp4', 'poster-site-tour.webp']) {
    const url = new URL(`../${file}`, import.meta.url);
    assert(fs.existsSync(url), `${file} is missing`);
    assert(fs.statSync(url).size > 0, `${file} is empty`);
  }
  assert(fs.statSync(new URL('../site-tour.mp4', import.meta.url)).size <= 10 * 1024 * 1024);
});
