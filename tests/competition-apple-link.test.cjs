/* Contest entry contract: submitted QR and demo URL keep working after Apple redirect. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const target = 'https://ndshuge.github.io/ndshuge-galaxy/little-works/xiaoya-apple/';

function redirect(source) {
  const url = new URL(source);
  let destination;
  const ctx = {
    URL, URLSearchParams,
    location: {
      href: url.href,
      origin: url.origin,
      search: url.search,
      hash: url.hash,
      replace(href) { destination = href; },
    },
  };
  const script = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(script, 'redirect script lives in the document head');
  assert.ok(html.indexOf('<script>') < html.indexOf('</head>'), 'redirect before body painting');
  vm.runInNewContext(script[1], ctx, {timeout: 500});
  return destination;
}

test('submitted judge link opens latest Galaxy Apple version', () => {
  assert.equal(redirect('https://ndshuge.github.io/xiaoya-lifelab/?judge=1'), target + '?judge=1');
});

test('unchanged base competition link opens the same Apple version', () => {
  assert.equal(redirect('https://ndshuge.github.io/xiaoya-lifelab/'), target);
});

test('judge links keep query options and hashes', () => {
  assert.equal(
    redirect('https://ndshuge.github.io/xiaoya-lifelab/?judge=1&mode=demo#today'),
    target + '?judge=1&mode=demo#today',
  );
});

test('original edition is explicitly accessible even on a judge link', () => {
  assert.equal(
    redirect('https://ndshuge.github.io/xiaoya-lifelab/?judge=1&edition=original#review'),
    'https://ndshuge.github.io/xiaoya-lifelab/original.html?judge=1#review',
  );
});

test('original edition direct link stays present', () => {
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'original.html')));
  assert.equal(
    redirect('https://ndshuge.github.io/xiaoya-lifelab/?edition=original'),
    'https://ndshuge.github.io/xiaoya-lifelab/original.html',
  );
});

test('without JavaScript, HTML fallback links to Apple edition', () => {
  assert.match(html, /<noscript>.*?url=\/ndshuge-galaxy\/little-works\/xiaoya-apple\//s);
});
