(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const KEY = 'shelf.v5', LIMIT = 2000;
  let items = [], shown = 36, filter = 'all', videos = new Map(), folderName = '', indexing = false;
  let activeVideoURL = '', editingCode = '', removed = null, rawRecovery = '';
  const el = (tag, props, ...children) => { const n = document.createElement(tag); Object.assign(n, props || {}); children.forEach((c) => { if (c !== null && c !== undefined) n.append(c); }); return n; };
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const label = (i) => i.userTitle || i.title || (i.kind === 'post' ? 'Instagram post' : i.kind === 'tv' ? 'Instagram video' : 'Instagram Reel');
  const warning = (message) => { $('#storage-warning').hidden = !message; $('#storage-warning').textContent = message; };
  const toast = (message, undo) => {
    const t = $('#toast'); t.replaceChildren(document.createTextNode(message));
    if (undo) t.append(el('button', { className: 'toast-undo', textContent: 'Undo', onclick: undo }));
    t.inert = false; t.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.classList.remove('show'); t.inert = true; }, undo ? 12000 : 5000);
  };
  function load() {
    try {
      const current = localStorage.getItem(KEY);
      const raw = current || localStorage.getItem('shelf.v4');
      if (!raw) return;
      rawRecovery = raw;
      if (raw.length > 20e6) throw new Error('Too much data');
      const data = JSON.parse(raw);
      if (!current) {
        const migrated = ShelfLib.migrateLegacy(data);
        items = migrated.items;
        if (migrated.skipped) warning(`${migrated.skipped} old entries could not be migrated. Export a recovery copy before editing; the old library is also retained in browser storage.`);
        else { rawRecovery = ''; toast('Your earlier Shelf library was restored. Open its files to confirm save status.'); }
        return;
      }
      if (!Array.isArray(data)) throw new Error('Invalid library');
      const seen = new Set();
      items = data.map(ShelfLib.sanitize).filter((i) => { if (!i || seen.has(i.code)) return false; seen.add(i.code); return true; });
      if (items.length !== data.length) warning('Some stored entries were invalid or duplicates. Export a recovery copy before making changes.');
      else rawRecovery = '';
    } catch (e) { warning('Your stored library could not be read, or browser storage is blocked. Export a recovery copy if available. New changes may replace the stored copy; keep a backup.'); }
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(items)); rawRecovery = ''; warning(''); }
    catch (e) { warning('Changes are only kept for this session: browser storage is full or blocked. Export your library before closing the page.'); }
  }
  function download(text, filename, type = 'application/json') {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = el('a', { href: url, download: filename }); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }
  function visible() {
    const kind = $('#kind').value, q = $('#q').value;
    const results = items.filter((i) => (filter === 'all' || (filter === 'todo' ? i.status !== 'saved' : i.status === filter)) && (kind === 'all' || i.kind === kind) && ShelfLib.matches(i, q));
    if ($('#sort').value === 'oldest') return results.slice().sort((a, b) => (a.addedAt || '').localeCompare(b.addedAt || ''));
    if ($('#sort').value === 'author') return results.slice().sort((a, b) => (a.author || label(a)).localeCompare(b.author || label(b)));
    return results.slice().sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));
  }
  function selected() { return items.filter((i) => i.selected); }
  function scriptText() { return ShelfLib.buildScript(ShelfScript.template, selected().map((i) => i.url)); }
  function updateSelection() {
    const count = selected().length;
    $('#selected-count').textContent = plural(count, 'selected item');
    const ready = count > 0 && count <= 500 && !indexing;
    $('#script').disabled = $('#guide-script').disabled = !ready;
    $('#script').title = count > 500 ? 'Choose at most 500 items per script.' : 'Download a script for selected items';
    $('#guide-script').textContent = count > 500 ? 'Select at most 500 items' : `Download script${count ? ` (${count})` : ''}`;
    const list = visible();
    $('#all').disabled = indexing || list.length === 0;
    $('#all').textContent = list.length && list.every((i) => i.selected) ? 'Deselect matching' : 'Select matching';
    if ($('#guide').open) updatePreview();
  }
  function updatePreview() {
    try { $('#script-preview').textContent = scriptText(); }
    catch (e) { $('#script-preview').textContent = selected().length ? e.message : 'Add and select a link to preview your generated script.'; }
  }
  function row(i) {
    const cb = el('input', { type: 'checkbox', checked: i.selected, disabled: indexing });
    cb.setAttribute('aria-label', `Select ${label(i)} ${i.code}`);
    const li = el('li', { className: 'item' + (i.selected ? ' is-selected' : '') });
    cb.onchange = () => { i.selected = cb.checked; li.classList.toggle('is-selected', i.selected); persist(); updateSelection(); };
    li.dataset.code = i.code;
    const top = el('div', { className: 'item-top' }, cb, el('span', { className: 'item-symbol', textContent: i.kind === 'post' ? '▦' : '▷' }), el('span', { className: 'item-type', textContent: i.kind }), el('span', { className: 'item-code', textContent: i.code }));
    top.querySelector('.item-symbol').setAttribute('aria-hidden', 'true');
    const body = el('div', { className: 'item-content' }, el('h3', { textContent: label(i) }), el('p', { className: 'item-author', textContent: i.author ? (i.author.startsWith('@') ? i.author : '@' + i.author) : 'Creator available after indexing' }));
    if (i.caption) {
      body.append(el('p', { className: 'item-caption', textContent: i.caption }));
      const details = el('details', {}, el('summary', { className: 'item-caption-summary', textContent: 'Full caption' }), el('p', { className: 'full-caption', textContent: i.caption })); body.append(details);
    } else body.append(el('p', { className: 'item-caption', textContent: 'A link worth coming back to. Add a note now, or index the saved files for its original caption.' }));
    if (i.userNote || (i.note && i.status !== 'failed')) body.append(el('p', { className: 'item-note', textContent: i.userNote || i.note }));
    const statusLabel = i.status === 'saved' ? 'Indexed' : i.status === 'failed' ? 'Needs attention' : 'To save';
    body.append(el('span', { className: 'item-status ' + i.status, textContent: statusLabel }));
    const files = videos.get(i.code) || [];
    if (files.length) body.append(el('p', { className: 'availability', textContent: `${plural(files.length, 'local video')} connected` }));
    else if (i.status === 'saved') body.append(el('p', { className: 'availability', textContent: 'Open your saved folder to reconnect playback.' }));
    if (i.status === 'failed') body.append(el('p', { className: 'failure-note', textContent: 'The script reported a failure. Partial files may be playable. Check Terminal, then select this item to retry.' }));
    const meta = [i.uploaded, i.duration ? `${Math.floor(i.duration / 60)}:${String(i.duration % 60).padStart(2, '0')}` : ''].filter(Boolean);
    if (meta.length) body.append(el('div', { className: 'item-meta', textContent: meta.join(' · ') }));
    const actions = el('div', { className: 'item-actions' });
    if (files.length) actions.append(el('button', { className: 'play-button', textContent: 'Play local', onclick: () => play(i) }));
    actions.append(el('a', { href: i.url, target: '_blank', rel: 'noopener noreferrer', textContent: 'Original' }), el('button', { textContent: 'Add note', disabled: indexing, onclick: () => edit(i) }), el('button', { className: 'remove-button', textContent: 'Remove', disabled: indexing, onclick: () => remove(i) }));
    li.append(top, body, actions); return li;
  }
  function render() {
    const list = visible();
    $('#list').replaceChildren(...list.slice(0, shown).map(row));
    $('#empty').hidden = items.length > 0;
    $('#no-results').hidden = !items.length || list.length > 0;
    $('#more').hidden = list.length <= shown;
    $('#more').textContent = `Show more (${Math.min(36, Math.max(0, list.length - shown))})`;
    $('#result-count').textContent = plural(list.length, 'item');
    const names = { all: 'All items', todo: 'To save', saved: 'Indexed', failed: 'Needs attention' };
    $('#library-title').textContent = names[filter];
    $('#view-title').replaceChildren(document.createTextNode(filter === 'all' ? 'Your library' : names[filter]), el('span', { className: 'title-dot', textContent: '.' }));
    ['all', 'todo', 'saved', 'failed'].forEach((f) => { $('#count-' + f).textContent = items.filter((i) => f === 'all' || (f === 'todo' ? i.status !== 'saved' : i.status === f)).length; });
    $('#navigation').querySelectorAll('button').forEach((b) => { b.classList.toggle('active', b.dataset.filter === filter); if (b.dataset.filter === filter) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    $('#export').disabled = !items.length && !rawRecovery;
    const indexed = items.filter((i) => i.status === 'saved').length;
    $('#folder-note').hidden = !indexed && !folderName;
    $('#folder-note').textContent = folderName ? `${folderName} · ${plural(videos.size, 'item')} connected this session. Files stay on your device. Open another folder to replace this connection.` : 'Your indexed metadata is remembered. Open the saved folder again to play local videos; browsers don’t retain file access after reload.';
    updateSelection();
  }
  function add(text) {
    if (indexing) { toast('Wait for your folder to finish indexing, then add links.'); return; }
    const r = ShelfLib.extract(text), known = new Set(items.map((i) => i.code));
    let added = 0, duplicate = r.duplicates, overflow = 0;
    r.links.forEach((link) => {
      if (known.has(link.code)) { duplicate++; return; }
      if (items.length >= LIMIT) { overflow++; return; }
      known.add(link.code); items.unshift(ShelfLib.sanitize({ ...link, selected: true, status: 'ready', addedAt: new Date().toISOString() })); added++;
    });
    const messages = [];
    if (added) messages.push(`${plural(added, 'link')} added`);
    if (duplicate) messages.push(`${duplicate} already in your library`);
    if (overflow) messages.push(`${overflow} not added: the ${LIMIT}-item library is full; export a backup before removing items`);
    if (r.share) messages.push('Share links need the original post URL. Open the post and copy its link.');
    if (!messages.length) messages.push('No Instagram post or Reel links found. Copy a full instagram.com/p/… or instagram.com/reel/… URL.');
    $('#addmsg').textContent = messages.join('. ') + '.';
    if (added) { if (!overflow) $('#paste').value = ''; shown = 36; persist(); render(); }
  }
  function openDialog(id) { if (!$('#' + id).open) $('#' + id).showModal(); }
  function guide() { updatePreview(); updateSelection(); openDialog('guide'); }
  function getScript() {
    try { download(scriptText(), 'shelf-instagram.sh', 'text/plain;charset=utf-8'); guide(); toast('Script prepared. Check your browser downloads, then review it before running.'); }
    catch (e) { toast(e.message); }
  }
  function edit(i) { if (indexing) return; editingCode = i.code; $('#edit-title').value = i.userTitle || ''; $('#edit-note').value = i.userNote || (i.status !== 'failed' ? i.note : '') || ''; openDialog('editor'); }
  function remove(i) {
    if (indexing) return;
    const position = items.indexOf(i); removed = { item: i, position };
    items.splice(position, 1); persist(); render();
    toast('Removed from library. Your saved files are untouched.', () => { if (!removed || indexing) return; const r = removed; if (!items.some((x) => x.code === r.item.code) && items.length < LIMIT) items.splice(Math.min(r.position, items.length), 0, r.item); removed = null; persist(); render(); toast('Restored to your library.'); });
    $('#q').focus({ preventScroll: true });
  }
  async function indexFiles(files) {
    if (indexing) return;
    indexing = true; $('#index').disabled = $('#add').disabled = $('#import').disabled = true; $('#idxmsg').textContent = 'Reading the files you chose… Library edits pause while indexing.'; $('#toast').classList.remove('show'); $('#toast').inert = true; render();
    closePlayer();
    try {
      const list = Array.from(files), map = new Map(items.map((i) => [i.code, { ...i }])), newVideos = new Map(), failedCodes = new Set();
      let read = 0, metadata = 0, skipped = 0, full = 0;
      const ensure = (base) => { let i = map.get(base.code); if (i) return i; if (map.size >= LIMIT) { full++; return null; } i = ShelfLib.sanitize({ ...base, selected: false, status: 'ready', addedAt: new Date().toISOString() }); map.set(i.code, i); return i; };
      for (const file of list) {
        const code = ShelfLib.fileCode(file);
        if (code && ShelfLib.isMediaFile(file)) { if (!newVideos.has(code)) newVideos.set(code, []); newVideos.get(code).push(file); }
      }
      for (const file of list) {
        if (file.name === 'shelf-failed.txt' && file.size < 1e6) { try { ShelfLib.extract(await file.text()).links.forEach((l) => { failedCodes.add(l.code); ensure(l); }); } catch (e) { skipped++; } }
        if (!file.name.endsWith('.info.json')) continue;
        if (file.size > 20e6 || read >= 5000) { skipped++; continue; } read++;
        try {
          const patch = ShelfLib.parseInfo(JSON.parse(await file.text()), ShelfLib.fileCode(file));
          if (!patch) { skipped++; continue; }
          const i = ensure(patch);
          if (i) { Object.assign(i, patch); metadata++; }
        } catch (e) { skipped++; }
        if (read % 40 === 0) { $('#idxmsg').textContent = `Reading metadata… ${read}`; await new Promise((resolve) => setTimeout(resolve, 0)); }
      }
      for (const [code, media] of newVideos) {
        const i = ensure({ code, kind: 'reel', url: `https://www.instagram.com/reel/${code}/` });
        if (i) { i.status = failedCodes.has(code) ? 'failed' : 'saved'; i.selected = false; media.sort((a, b) => a.name.localeCompare(b.name)); }
      }
      for (const code of failedCodes) { const i = map.get(code); if (i) i.status = 'failed'; }
      items = [...map.values()].sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));
      videos = new Map([...newVideos].filter(([code]) => map.has(code))); folderName = list[0] ? (list[0].webkitRelativePath.split('/')[0] || 'Saved folder') : '';
      persist(); render();
      const mediaCount = [...videos.values()].reduce((n, files) => n + files.length, 0);
      $('#idxmsg').textContent = `${plural(metadata, 'metadata record')} indexed · ${plural(mediaCount, 'video')} connected.${skipped ? ` ${skipped} metadata files could not be read or exceeded the limit.` : ''}${full ? ` Some new items were omitted because the ${LIMIT}-item library is full.` : ''}${!mediaCount && !metadata ? ' Choose the Shelf folder containing shortcode subfolders and .info.json files.' : ''}`;
    } catch (e) { $('#idxmsg').textContent = 'Could not finish reading that folder. Your library was kept. Try opening the folder again.'; }
    finally { indexing = false; $('#index').disabled = $('#add').disabled = $('#import').disabled = false; render(); }
  }
  function switchVideo(file) {
    const video = $('#video'); video.pause();
    if (activeVideoURL) URL.revokeObjectURL(activeVideoURL);
    activeVideoURL = URL.createObjectURL(file); video.src = activeVideoURL;
    $('#video-message').textContent = file.name + ' · Playback depends on your browser’s supported video formats.';
    video.play().catch(() => {});
  }
  function play(i) {
    const files = videos.get(i.code); if (!files || !files.length) return;
    $('#player-title').textContent = i.userTitle || i.title || 'Local video';
    $('#video-parts').replaceChildren(...files.map((f, n) => el('option', { value: String(n), textContent: `${n + 1}. ${f.name}` })));
    $('#video-parts').hidden = files.length < 2;
    $('#video-parts').onchange = () => switchVideo(files[Number($('#video-parts').value)]);
    openDialog('player'); switchVideo(files[0]);
  }
  function closePlayer() { const v = $('#video'); v.pause(); if (activeVideoURL) URL.revokeObjectURL(activeVideoURL); activeVideoURL = ''; v.removeAttribute('src'); v.load(); if ($('#player').open) $('#player').close(); }
  function exportLibrary() {
    if (rawRecovery) { download(rawRecovery, 'shelf-recovery.txt', 'text/plain'); toast('Recovery copy downloaded. Keep it before changing your library.'); return; }
    download(JSON.stringify({ app: 'Shelf', version: 1, exportedAt: new Date().toISOString(), items }, null, 2), `shelf-library-${new Date().toISOString().slice(0, 10)}.json`);
    toast('Backup prepared. Check your browser downloads; keep your videos separately.');
  }
  async function importLibrary(file) {
    if (!file) return;
    if (indexing) { toast('Wait for indexing to finish before importing a backup.'); return; }
    try {
      if (file.size > 20e6) throw new Error('Backup is too large. The limit is 20 MB.');
      const data = JSON.parse(await file.text()), records = Array.isArray(data) ? data : data && data.app === 'Shelf' && data.version === 1 ? data.items : null;
      if (indexing) throw new Error('Folder indexing started while reading. Import this backup again after it finishes.');
      if (!Array.isArray(records)) throw new Error('Choose a Shelf JSON library backup.');
      const incoming = records.map(ShelfLib.sanitize);
      if (incoming.some((i) => !i)) throw new Error('The backup contains invalid records. No changes were made.');
      const map = new Map(items.map((i) => [i.code, i])); let added = 0;
      incoming.forEach((i) => { if (!map.has(i.code)) { map.set(i.code, i); added++; } });
      if (map.size > LIMIT) throw new Error(`This backup would exceed ${LIMIT} items. Export your current library before removing items.`);
      items = [...map.values()].sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || '')); persist(); render();
      toast(`${plural(added, 'item')} imported. Existing items and notes were kept. Reopen a folder for playback.`);
    } catch (e) { toast(e instanceof SyntaxError ? 'This file is not valid JSON. No changes were made.' : e.message); }
  }
  $('#add').onclick = () => add($('#paste').value);
  $('#paste').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); add($('#paste').value); } });
  document.addEventListener('paste', (e) => { if (!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !e.target.isContentEditable && !document.querySelector('dialog[open]')) { const text = e.clipboardData.getData('text'); if (ShelfLib.extract(text).links.length) { e.preventDefault(); add(text); } } });
  $('#navigation').querySelectorAll('button').forEach((button) => { button.onclick = () => { filter = button.dataset.filter; shown = 36; render(); }; });
  $('#q').oninput = $('#kind').onchange = $('#sort').onchange = () => { shown = 36; render(); };
  $('#all').onclick = () => { const list = visible(), state = list.some((i) => !i.selected); list.forEach((i) => { i.selected = state; }); persist(); render(); };
  $('#reset').onclick = () => { filter = 'all'; $('#q').value = ''; $('#kind').value = 'all'; shown = 36; render(); $('#q').focus(); };
  $('#script').onclick = $('#guide-script').onclick = getScript;
  $('#help').onclick = $('#workflow-help').onclick = guide;
  $('#empty-add').onclick = () => $('#paste').focus();
  $('#more').onclick = () => { shown += 36; render(); $('#more').focus({ preventScroll: true }); };
  $('#index').onclick = () => $('#dir').click();
  $('#dir').onchange = (e) => { const files = Array.from(e.target.files); e.target.value = ''; if (files.length) indexFiles(files); };
  $('#export').onclick = exportLibrary; $('#import').onclick = () => $('#backup').click();
  $('#backup').onchange = (e) => { const file = e.target.files[0]; e.target.value = ''; importLibrary(file); };
  $('#edit-form').onsubmit = (e) => { e.preventDefault(); if (indexing) return; const i = items.find((i) => i.code === editingCode); if (i) { i.userTitle = $('#edit-title').value.trim(); i.userNote = $('#edit-note').value.trim(); persist(); render(); } $('#editor').close(); const card = [...$('#list').children].find((n) => n.dataset.code === editingCode); if (card) card.querySelector('input').focus({ preventScroll: true }); else $('#q').focus({ preventScroll: true }); toast('Note saved. Search your library to find it again.'); };
  document.querySelectorAll('[data-close]').forEach((button) => { button.onclick = () => button.dataset.close === 'player' ? closePlayer() : $('#' + button.dataset.close).close(); });
  $('#player').addEventListener('close', () => { if (activeVideoURL) closePlayer(); });
  $('#video').addEventListener('error', () => { if (activeVideoURL) $('#video-message').textContent = 'This browser couldn’t play this file. Open the video in a compatible local player.'; });
  $('#copy-command').onclick = async () => { try { await navigator.clipboard.writeText('cd ~/Downloads && bash shelf-instagram.sh'); $('#copy-command').textContent = 'Copied'; setTimeout(() => { $('#copy-command').textContent = 'Copy'; }, 2000); } catch (e) { $('#copy-command').textContent = 'Select text'; toast('Clipboard unavailable. Select and copy the displayed command.'); } };
  window.addEventListener('pagehide', () => { if (activeVideoURL) URL.revokeObjectURL(activeVideoURL); });
  load(); render();
})();
