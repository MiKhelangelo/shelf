// Pure logic shared by the static page and the Node tests.
(function (root) {
  const KIND = { p: 'post', reel: 'reel', reels: 'reel', tv: 'tv' };
  const STRICT = /^https:\/\/www\.instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]{5,20})\/$/;
  const CODE = /^[A-Za-z0-9_-]{5,20}$/;
  const HOSTS = new Set(['instagram.com', 'www.instagram.com', 'm.instagram.com']);
  const PATH = /^\/(?:[A-Za-z0-9._]+\/)?(p|reels?|tv)\/([A-Za-z0-9_-]{5,20})\/?$/i;
  const canon = (kind, code) => `https://www.instagram.com/${kind === 'post' ? 'p' : kind}/${code}/`;
  const clip = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '');
  const duration = (v) => (Number.isFinite(v) && v >= 0 ? Math.min(86400, Math.round(v)) : 0);

  function calendarDate(v) {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
    const d = new Date(v + 'T00:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : '';
  }

  function timestamp(v) {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v)) return '';
    const d = new Date(v);
    return calendarDate(v.slice(0, 10)) && Number.isFinite(d.getTime())
      && d.toISOString().slice(0, 19) === v.slice(0, 19) ? d.toISOString() : '';
  }

  function instagramURL(value) {
    if (typeof value !== 'string' || value.length > 2048) return null;
    let url;
    try { url = new URL(value.trim()); } catch (e) { return null; }
    return (url.protocol === 'https:' || url.protocol === 'http:') && HOSTS.has(url.hostname)
      && !url.username && !url.password && !url.port ? url : null;
  }

  function parseLink(value) {
    const url = instagramURL(value);
    if (!url || /^\/share(?:\/|$)/i.test(url.pathname)) return null;
    const m = PATH.exec(url.pathname);
    if (!m) return null;
    const kind = KIND[m[1].toLowerCase()], code = m[2];
    return { code, kind, url: canon(kind, code) };
  }

  function extract(text) {
    const clean = String(text).normalize('NFKC').replace(/\p{Cf}/gu, '').slice(0, 500000);
    const seen = new Set(), links = [];
    let duplicates = 0, share = false;
    for (const m of clean.matchAll(/https?:\/\/[^\s<>"'`]+/gi)) {
      // Punctuation surrounding a link is prose, not part of its path.
      const candidate = m[0].replace(/[),.;!?\]}:]+$/, '');
      const url = instagramURL(candidate);
      if (url && /^\/share(?:\/|$)/i.test(url.pathname)) share = true;
      const link = parseLink(candidate);
      if (!link) continue;
      if (seen.has(link.code)) { duplicates++; continue; }
      seen.add(link.code); links.push(link);
    }
    return { links, duplicates, share };
  }

  // Every word must appear in the author, caption, title, note, shortcode or kind.
  function matches(item, q) {
    const words = String(q || '').toLowerCase().split(/\s+/).map((w) => w.replace(/^#/, '')).filter(Boolean);
    if (!words.length) return true;
    const hay = [item.code, item.kind, item.author, item.title, item.userTitle, item.caption, item.note, item.userNote].join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  }

  // Rebuild a stored or imported item from untrusted JSON.
  function sanitize(i) {
    if (!i || typeof i !== 'object' || Array.isArray(i)) return null;
    const link = parseLink(i.url);
    if (!link) return null;
    return Object.assign(link, {
      status: i.status === 'saved' || i.status === 'failed' ? i.status : 'ready',
      selected: i.selected !== false,
      author: clip(i.author, 160), title: clip(i.title, 300), userTitle: clip(i.userTitle, 240),
      caption: clip(i.caption, 20000), note: clip(i.note, 1000), userNote: clip(i.userNote, 1000),
      duration: duration(i.duration), uploaded: calendarDate(i.uploaded), addedAt: timestamp(i.addedAt),
    });
  }

  // v4 was a link planner: its manual "saved" flag never verified local media.
  // This migration reads data only; the old storage key remains a recovery copy.
  function migrateLegacy(input) {
    const source = input && typeof input === 'object' && !Array.isArray(input) && Array.isArray(input.items) ? input.items : [];
    const items = [];
    let skipped = 0;
    for (const legacy of source) {
      if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)
        || (typeof legacy.kind === 'string' && /^(?:tag|hashtag|search|tag[-_ ]?search)$/i.test(legacy.kind))) {
        skipped++; continue;
      }
      const collection = clip(legacy.collection, 160);
      const tags = clip(Array.isArray(legacy.tags) ? legacy.tags.slice(0, 32).map((tag) => clip(tag, 80)).filter(Boolean).join(', ') : legacy.tags, 500);
      const notes = [clip(legacy.note, 1000), collection ? `Collection: ${collection}` : '', tags ? `Tags: ${tags}` : ''].filter(Boolean).join(' · ');
      let addedAt = timestamp(legacy.savedAt);
      if (!addedAt && Number.isFinite(legacy.savedAt) && legacy.savedAt >= 0) {
        const saved = new Date(legacy.savedAt);
        if (Number.isFinite(saved.getTime())) addedAt = saved.toISOString();
      }
      const item = sanitize({
        url: legacy.url, selected: legacy.selected, author: legacy.author,
        userTitle: legacy.title, caption: legacy.description, userNote: notes,
        addedAt, status: legacy.status === 'failed' ? 'failed' : 'ready',
      });
      if (item) items.push(item); else skipped++;
    }
    return { items, skipped };
  }

  // An explicit permalink must agree with its shortcode folder. Missing links may use the folder.
  function parseInfo(info, dirName) {
    if (!info || typeof info !== 'object' || Array.isArray(info)) return null;
    const folderCode = CODE.test(dirName || '') ? dirName : '';
    const sources = [info.webpage_url, info.original_url].filter((s) => s !== undefined && s !== null && s !== '');
    const links = sources.map(parseLink);
    if (links.some((l) => !l || (folderCode && folderCode !== l.code))) return null;
    const link = links[0] || null;
    if (links.some((l) => l.code !== link.code)) return null;
    const base = link || (folderCode ? { code: folderCode, kind: 'reel', url: canon('reel', folderCode) } : null);
    if (!base) return null;
    const d = typeof info.upload_date === 'string' ? info.upload_date : '';
    return Object.assign({}, base, {
      author: clip(info.uploader || info.channel, 160), title: clip(info.title, 300),
      caption: clip(info.description || info.title, 20000), duration: duration(info.duration),
      uploaded: /^\d{8}$/.test(d) ? calendarDate(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`) : '',
    });
  }

  function fileCode(file) {
    if (!file) return '';
    const relative = file.webkitRelativePath || file.name;
    if (typeof relative !== 'string' || relative.length > 4096 || relative.includes('\\')) return '';
    const parts = relative.split('/');
    if (parts.length < 3 || parts.some((p) => !p || p === '.' || p === '..')) return '';
    const code = parts[parts.length - 2];
    return CODE.test(code || '') ? code : '';
  }

  function isMediaFile(file) {
    return Boolean(file && typeof file.name === 'string' && Number.isFinite(file.size) && file.size > 0
      && /\.(mp4|mov|m4v|webm|mkv)$/i.test(file.name));
  }

  function buildScript(template, urls) {
    if (!Array.isArray(urls) || !urls.length || urls.length > 500) throw new Error('Choose between 1 and 500 links.');
    urls.forEach((u) => { if (typeof u !== 'string' || !STRICT.test(u)) throw new Error('Unexpected link.'); });
    if (typeof template !== 'string' || template.split('%URLS%').length !== 2) throw new Error('The script template is unavailable. Reload Shelf and try again.');
    return template.replace('%URLS%', [...new Set(urls)].map((u) => `  '${u}'`).join('\n'));
  }

  const api = { extract, matches, sanitize, migrateLegacy, parseInfo, buildScript, fileCode, isMediaFile, isCode: (s) => typeof s === 'string' && CODE.test(s) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ShelfLib = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
