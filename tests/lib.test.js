const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { extract, matches, sanitize, migrateLegacy, parseInfo, buildScript, fileCode, isMediaFile } = require('../lib.js');
const { template } = require('../shelf-script.js');
const good = 'https://www.instagram.com/reel/AAAAA11111/';
const failed = 'https://www.instagram.com/p/FAILFAIL11/';
const prior = 'https://www.instagram.com/reel/PRIORFAIL1/';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shelf-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const binDir = path.join(dir, 'bin'), out = path.join(dir, 'out');
  fs.mkdirSync(binDir); fs.mkdirSync(out);
  fs.writeFileSync(path.join(binDir, 'yt-dlp'), `#!/bin/bash
while [ "$#" -gt 0 ]; do
  case "$1" in -P) d="$2"; shift 2;; --) u="$2"; shift 2;; *) shift;; esac
done
c="\${u%/}"; c="\${c##*/}"
printf '%s\\n' "$u" >> "$FAKE_LOG"
case "$c" in
  FAILFAIL11) exit 1;;
  EMPTYEMPTY) : > "$d/$c.mp4"; echo '{}' > "$d/$c.info.json"; exit 0;;
  METAONLY11) echo '{}' > "$d/$c.info.json"; exit 0;;
  VIDEOONLY1) echo x > "$d/$c.mp4"; exit 0;;
  PARTPART11) echo x > "$d/$c.mp4.part"; echo '{}' > "$d/$c.info.json"; exit 0;;
esac
echo x > "$d/$c.mp4"
printf '{"webpage_url":"%s","description":"A caption"}\\n' "$u" > "$d/$c.info.json"
`, { mode: 0o755 });
  const env = { ...process.env, HOME: dir, PATH: `${binDir}:/usr/bin:/bin`, SHELF_OUT: out, SHELF_PAUSE: '0', FAKE_LOG: path.join(dir, 'calls.txt') };
  const script = path.join(dir, 'shelf-instagram.sh');
  const write = (urls) => fs.writeFileSync(script, buildScript(template, urls));
  const run = (urls) => { if (urls) write(urls); return spawnSync('/bin/bash', [script], { env, encoding: 'utf8', timeout: 10000 }); };
  const failureLog = () => fs.readFileSync(path.join(out, 'shelf-failed.txt'), 'utf8');
  const calls = () => fs.existsSync(env.FAKE_LOG) ? fs.readFileSync(env.FAKE_LOG, 'utf8').trim().split('\n').filter(Boolean) : [];
  return { dir, out, env, script, write, run, failureLog, calls };
}

function seedComplete(f, code) {
  const dir = path.join(f.out, code); fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, code + '.mp4'), 'video');
  fs.writeFileSync(path.join(dir, code + '.info.json'), '{}');
}

test('extracts canonical posts, reels, usernames and queries; deduplicates shortcodes', () => {
  const result = extract('a https://www.instagram.com/reel/C-MQtfQt0by/?igsh=x b instagram.com/p/AbCdE12345/ https://www.instagram.com/someone/reel/C-MQtfQt0by/ https://m.instagram.com/tv/ZZZZZ99999');
  assert.deepEqual(result.links.map((l) => l.url), ['https://www.instagram.com/reel/C-MQtfQt0by/', 'https://www.instagram.com/tv/ZZZZZ99999/']);
  assert.equal(result.duplicates, 1);
  assert.equal(extract('(HTTP://INSTAGRAM.COM/reels/AAAAA11111/).').links[0].url, good);
});

test('rejects lookalike hosts, credentials, unexpected paths and overlong shortcodes', () => {
  for (const url of [
    'https://evilinstagram.com/reel/AAAAA11111/', 'https://instagram.com.evil.io/reel/AAAAA11111/',
    'https://instagram.com@evil.io/reel/AAAAA11111/', 'https://evil.io/https://instagram.com/reel/AAAAA11111/',
    'https://user:secret@instagram.com/reel/AAAAA11111/', 'https://instagram.com:8443/reel/AAAAA11111/',
    'https://instagram.com/reel/AAAAA11111/extra', 'https://instagram.com/reel/AAAAAAAAAAAAAAAAAAAAA/',
  ]) assert.equal(extract(url).links.length, 0, url);
  const share = extract('https://www.instagram.com/share/reel/DaiB5OdoqWX');
  assert.equal(share.links.length, 0); assert.equal(share.share, true);
  assert.equal(extract('https://evilinstagram.com/share/reel/DaiB5OdoqWX').share, false);
});

test('search covers scraped metadata and manual titles and notes', () => {
  const item = { code: 'AbCdE12345', kind: 'reel', author: 'Chef Ann', title: 'Dinner', userTitle: 'Family favorite', caption: 'Pasta #weeknight', note: 'Try Saturday' };
  assert.ok(matches(item, 'ann PASTA #weeknight'));
  assert.ok(matches(item, 'favorite Saturday')); assert.ok(!matches(item, 'pizza'));
});

test('sanitize rebuilds imported items and preserves bounded manual fields and timestamps', () => {
  assert.equal(sanitize({ url: 'https://evil.com/x' }), null);
  assert.equal(sanitize({ url: 'see ' + good }), null);
  const item = sanitize({ url: good + '?x=1', status: 'weird', author: 5, duration: -4, userTitle: 'My title', note: 'My note', addedAt: '2026-10-03T10:20:30Z', uploaded: '2026-02-30', caption: 'x'.repeat(21000), extra: true });
  assert.equal(item.status, 'ready'); assert.equal(item.author, ''); assert.equal(item.duration, 0);
  assert.equal(item.userTitle, 'My title'); assert.equal(item.note, 'My note');
  assert.equal(item.addedAt, '2026-10-03T10:20:30.000Z'); assert.equal(item.uploaded, '');
  assert.equal(item.caption.length, 20000); assert.equal(item.extra, undefined);
  assert.equal(sanitize({ url: good, addedAt: '2026-10-03T24:00:00Z' }).addedAt, '');
});

test('parseInfo validates dates and folder association without discarding long captions', () => {
  const info = parseInfo({ webpage_url: 'https://www.instagram.com/reel/C-MQtfQt0by/', uploader: 'chef_ann', description: 'Pasta\n#dinner', duration: 12.6, upload_date: '20260115' }, 'C-MQtfQt0by');
  assert.deepEqual([info.code, info.author, info.caption, info.duration, info.uploaded], ['C-MQtfQt0by', 'chef_ann', 'Pasta #dinner', 13, '2026-01-15']);
  assert.equal(parseInfo({}, 'bad dir'), null);
  assert.equal(parseInfo({}, 'AbCdE12345').kind, 'reel');
  assert.equal(parseInfo({ webpage_url: good }, 'OTHER12345'), null);
  assert.equal(parseInfo({ webpage_url: 'https://evil.io/x' }, 'AAAAA11111'), null);
  assert.equal(parseInfo({ webpage_url: good, original_url: failed }, 'AAAAA11111'), null);
  assert.equal(parseInfo({ webpage_url: 0 }, 'AAAAA11111'), null);
  const long = parseInfo({ description: 'a'.repeat(18000), upload_date: '20260230', duration: -2 }, 'AAAAA11111');
  assert.equal(long.caption.length, 18000); assert.equal(long.uploaded, ''); assert.equal(long.duration, 0);
});

test('legacy migration preserves permalink notes and never claims manually saved files are verified', () => {
  const input = { items: [
    { url: good + '?igsh=private', shortcode: 'untrusted', kind: 'reel', title: 'My favorite', description: 'Original caption', author: 'chef_ann', note: 'Try Saturday', collection: 'Cooking', tags: ['dinner', '#pasta', { unwanted: 'object' }], selected: false, status: 'saved', savedAt: '2026-10-03T10:20:30Z' },
    { url: failed, status: 'failed', savedAt: Date.UTC(2026, 9, 3) },
    { url: 'https://www.instagram.com/reel/ALREADY123/', status: 'already', note: 'x'.repeat(2000), savedAt: 'bad date' },
    { url: 'https://www.instagram.com/explore/tags/pasta/', kind: 'tag' },
    { url: good, kind: 'tag-search' },
    { url: 'https://instagram.com.evil.io/reel/AAAAA11111/' }, null,
  ], settings: { untrusted: true } };
  const before = JSON.stringify(input), migrated = migrateLegacy(input);
  assert.equal(JSON.stringify(input), before, 'migration must not mutate the recovery data');
  assert.equal(migrated.items.length, 3); assert.equal(migrated.skipped, 4);
  const item = migrated.items[0];
  assert.equal(item.url, good); assert.equal(item.code, 'AAAAA11111'); assert.equal(item.kind, 'reel');
  assert.equal(item.userTitle, 'My favorite'); assert.equal(item.caption, 'Original caption'); assert.equal(item.author, 'chef_ann');
  assert.equal(item.userNote, 'Try Saturday · Collection: Cooking · Tags: dinner, #pasta');
  assert.equal(item.selected, false); assert.equal(item.status, 'ready'); assert.equal(item.addedAt, '2026-10-03T10:20:30.000Z');
  assert.equal(migrated.items[1].status, 'failed'); assert.equal(migrated.items[1].addedAt, '2026-10-03T00:00:00.000Z');
  assert.equal(migrated.items[2].status, 'ready'); assert.equal(migrated.items[2].userNote.length, 1000); assert.equal(migrated.items[2].addedAt, '');
  assert.deepEqual(migrateLegacy({ items: 'malformed' }), { items: [], skipped: 0 });
  assert.deepEqual(migrateLegacy(null), { items: [], skipped: 0 });
});

test('file helpers require complete nonempty media and a safe immediate folder', () => {
  const file = { name: 'clip.MP4', size: 10, webkitRelativePath: 'Shelf/AAAAA11111/clip.MP4' };
  assert.equal(fileCode(file), 'AAAAA11111'); assert.ok(isMediaFile(file));
  assert.equal(fileCode({ ...file, webkitRelativePath: 'Shelf/../AAAAA11111/clip.mp4' }), '');
  assert.equal(fileCode({ ...file, webkitRelativePath: 'Shelf/not a code/clip.mp4' }), '');
  assert.equal(fileCode({ name: 'clip.mp4' }), '');
  assert.equal(fileCode({ ...file, webkitRelativePath: 'Instagram-Reels/clip.mp4' }), '');
  assert.equal(fileCode({ ...file, webkitRelativePath: 'AAAAA11111/clip.mp4' }), '');
  for (const name of ['clip.mp4.part', 'clip.mp4.ytdl', 'clip.info.json', 'clip.jpg']) assert.equal(isMediaFile({ name, size: 10 }), false);
  assert.equal(isMediaFile({ ...file, size: 0 }), false);
});

test('buildScript rejects shell injection, empty/oversized lists and missing templates', () => {
  assert.throws(() => buildScript(template, [good + "'; rm -rf ~; '"]));
  assert.throws(() => buildScript(template, []));
  assert.throws(() => buildScript(template, Array(501).fill(good)));
  assert.throws(() => buildScript('missing placeholder', [good]));
  assert.throws(() => buildScript(template, [null]));
  const script = buildScript(template, [good, good]);
  assert.equal(script.split(good).length - 1, 1);
});

test('browser globals expose the same template and helpers as CommonJS', () => {
  const context = vm.createContext({ URL });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../lib.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../shelf-script.js'), 'utf8'), context);
  assert.equal(context.ShelfScript.template, template);
  assert.equal(context.ShelfLib.extract(good).links[0].url, good);
});

test('generated Bash uses yt-dlp on PATH, verifies files and returns failure for partial batches', (t) => {
  const f = fixture(t);
  f.write([good, failed]);
  assert.equal(spawnSync('/bin/bash', ['-n', f.script]).status, 0);
  const result = f.run();
  assert.equal(result.status, 1, result.stderr); assert.match(result.stdout, /1 saved, 1 failed/);
  assert.ok(fs.statSync(path.join(f.out, 'AAAAA11111', 'AAAAA11111.mp4')).size > 0);
  assert.deepEqual(f.calls(), [good, failed]); assert.equal(f.failureLog().trim(), failed);
  const again = f.run();
  assert.equal(again.status, 1); assert.match(again.stdout, /Already saved: AAAAA11111/);
  assert.deepEqual(f.calls(), [good, failed, failed]); assert.equal(f.failureLog().trim(), failed);
});

test('retry success reconciles only attempted failures and retains unrelated earlier failures', (t) => {
  const f = fixture(t); seedComplete(f, 'AAAAA11111');
  fs.writeFileSync(path.join(f.out, 'shelf-failed.txt'), prior + '\n' + good.replace('/reel/', '/p/') + '\n');
  const result = f.run([good]);
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /1 saved, 0 failed \(0 already present\)/);
  assert.deepEqual(f.calls(), [good]); assert.equal(f.failureLog(), prior + '\n');
  assert.equal(fs.existsSync(path.join(f.out, '.shelf-download-lock')), false);
});

test('failed posts with partial completed media are retried instead of silently skipped', (t) => {
  const f = fixture(t); seedComplete(f, 'FAILFAIL11');
  fs.writeFileSync(path.join(f.out, 'shelf-failed.txt'), failed + '\n');
  const result = f.run([failed]);
  assert.equal(result.status, 1); assert.deepEqual(f.calls(), [failed]);
  assert.equal(f.failureLog(), failed + '\n'); assert.doesNotMatch(result.stdout, /Already saved/);
});

test('zero-byte videos, partial files and metadata alone never count as saved', (t) => {
  const f = fixture(t);
  const urls = ['EMPTYEMPTY', 'METAONLY11', 'VIDEOONLY1', 'PARTPART11'].map((code) => `https://www.instagram.com/reel/${code}/`);
  const result = f.run(urls);
  assert.equal(result.status, 1); assert.match(result.stdout, /0 saved, 4 failed/);
  assert.deepEqual(f.failureLog().trim().split('\n'), urls);
  assert.match(result.stderr, /no complete video and metadata pair/);
});

test('a completed video missing metadata is retried and indexed sidecar can be restored', (t) => {
  const f = fixture(t), dir = path.join(f.out, 'AAAAA11111');
  fs.mkdirSync(dir); fs.writeFileSync(path.join(dir, 'clip.mp4'), 'video');
  const result = f.run([good]);
  assert.equal(result.status, 0, result.stderr); assert.deepEqual(f.calls(), [good]);
  assert.ok(fs.existsSync(path.join(dir, 'AAAAA11111.info.json')));
});

test('runtime URL validation stops unexpected hosts before output changes', (t) => {
  const f = fixture(t); f.write([good]);
  fs.writeFileSync(f.script, fs.readFileSync(f.script, 'utf8').replace(good, 'https://evil.io/reel/AAAAA11111/'));
  const result = f.run();
  assert.equal(result.status, 2); assert.match(result.stderr, /Refusing unexpected link/);
  assert.deepEqual(f.calls(), []); assert.deepEqual(fs.readdirSync(f.out), []);
});

test('an active lock or unreadable failure-log path blocks work without destroying history', (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.out, 'shelf-failed.txt'), prior + '\n');
  fs.mkdirSync(path.join(f.out, '.shelf-download-lock'));
  const result = f.run([good]);
  assert.equal(result.status, 1); assert.match(result.stderr, /download lock/);
  assert.equal(f.failureLog(), prior + '\n'); assert.deepEqual(f.calls(), []);
});
