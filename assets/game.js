// Spot Kaboomby for kaboomby.com/play/. Everything stays in this browser: no accounts, no analytics, no leaderboard.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Local storage when the browser allows it, otherwise memory for this visit only
  var memory = {};
  var local = (function () { try { localStorage.setItem('kb-t', '1'); localStorage.removeItem('kb-t'); return localStorage; } catch (e) { return null; } })();
  function read(k, fallback) {
    try { var v = local ? local.getItem(k) : memory[k]; return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
  }
  function write(k, v) {
    var s = JSON.stringify(v);
    try { if (local) { local.setItem(k, s); return; } } catch (e) {}
    memory[k] = s;
  }
  function clearAll() {
    memory = {};
    try { if (local) Object.keys(local).filter(function (k) { return k.indexOf('kb-spot-') === 0; }).forEach(function (k) { local.removeItem(k); }); } catch (e) {}
  }

  var LINES = { intro: 'Can you find me? There are five of me!', found: 'You found me!', all_found: 'You found all five! Yaaay!' };
  var ua = navigator.userAgent;
  var webkitOnly = /iP(hone|ad|od)/.test(ua) || (/Safari\//.test(ua) && !/(Chrome|Chromium|CriOS|Edg|Firefox|FxiOS|OPR)\//.test(ua)) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var alphaOk = !webkitOnly && document.createElement('video').canPlayType('video/webm; codecs="vp9, opus"') !== '';

  var scenes = [], index = -1, found = new Set(), running = false, finished = false, elapsed = 0, tickAt = 0, assisted = false, imgReady = false;
  var sound = read('kb-spot-sound', true);
  var board = $('board'), art = $('art'), view = $('viewport'), cover = $('cover');
  var reactor = $('reactor'), still = reactor.querySelector('img'), clip = reactor.querySelector('video'), say = $('say');

  // ---------- Kaboomby reactions: one at a time, never layered ----------
  function react(name) {
    say.textContent = LINES[name];
    still.src = '../assets/spot-' + name + '.webp';
    if (reduce) return;
    clip.pause();
    clip.muted = !sound;
    clip.src = '../assets/spot-' + name + (alphaOk ? '.webm' : '.mp4');
    reactor.classList.add('on');
    var r = clip.play();
    if (r && r.catch) r.catch(function () { reactor.classList.remove('on'); });
  }
  function quiet() { clip.pause(); reactor.classList.remove('on'); }
  clip.addEventListener('ended', function () { reactor.classList.remove('on'); });
  clip.addEventListener('error', function () { reactor.classList.remove('on'); });

  // ---------- Picture order: shuffled bag, no repeats until all twenty are played ----------
  function shuffled(n) {
    var a = []; for (var i = 0; i < n; i++) a.push(i);
    for (var j = a.length - 1; j > 0; j--) { var k = Math.floor(Math.random() * (j + 1)); var t = a[j]; a[j] = a[k]; a[k] = t; }
    return a;
  }
  function bag() {
    var b = read('kb-spot-bag', []).filter(function (i) { return Number.isInteger(i) && i >= 0 && i < scenes.length; });
    if (!b.length) {
      b = shuffled(scenes.length);
      var last = read('kb-spot-last', -1);
      if (b[0] === last && b.length > 1) { b.push(b.shift()); }
    }
    return b;
  }
  function takeNext() {
    var b = bag(), n = b.shift();
    if (n === index && b.length) { b.push(n); n = b.shift(); }
    write('kb-spot-bag', b);
    write('kb-spot-last', n);
    return n;
  }
  function peekNext() { var b = bag(); return b[0] === index && b.length > 1 ? b[1] : b[0]; }

  // ---------- Timer ----------
  function settle() {
    if (running) { var now = performance.now(); elapsed += now - tickAt; tickAt = now; }
    $('time').textContent = (elapsed / 1000).toFixed(1);
  }
  setInterval(function () { if (running) settle(); }, 100);

  function showCover(text, button, action) {
    $('coverText').textContent = text;
    var b = $('coverBtn');
    b.textContent = button; b.hidden = !button; b.onclick = action || null;
    cover.hidden = false;
  }
  function pause(reason) {
    if (!running) return;
    settle(); running = false; quiet();
    $('pause').textContent = 'Resume'; $('pause').setAttribute('aria-pressed', 'true');
    showCover(reason || 'Paused. The timer has stopped.', 'Keep finding', resume);
  }
  function resume() {
    if (finished || !imgReady) return;
    running = true; tickAt = performance.now();
    cover.hidden = true;
    $('pause').hidden = false; $('pause').textContent = 'Pause'; $('pause').setAttribute('aria-pressed', 'false');
  }
  function start() {
    if (!imgReady || running || finished) return;
    react('intro');
    resume();
    $('msg').textContent = 'Find all five Kaboomby characters!';
  }

  // ---------- Scenes ----------
  function loadScene(i) {
    settle(); running = false; finished = false; quiet();
    index = i; found.clear(); elapsed = 0; assisted = false; imgReady = false;
    var s = scenes[i];
    $('time').textContent = '0.0'; $('count').textContent = '0';
    $('title').textContent = s.title;
    $('results').hidden = true;
    $('pause').hidden = true;
    board.querySelectorAll('.mark').forEach(function (m) { m.remove(); });
    board.classList.remove('zoomed'); $('zoom').setAttribute('aria-pressed', 'false'); $('zoom').textContent = 'Zoom in';
    say.textContent = ''; still.src = '../assets/spot-intro.webp';
    showCover('Loading the picture…', '', null);
    art.alt = s.title + ': a picture with five little Kaboomby characters hiding in it.';
    art.onload = function () {
      imgReady = true;
      showCover('Five Kaboombys are hiding in ' + s.title + '.', 'Start finding!', start);
      var n = peekNext(); if (n != null && n !== index) { var pre = new Image(); pre.src = '../assets/' + scenes[n].board; }
    };
    art.onerror = function () { showCover('This picture could not load.', 'Try the next picture', function () { loadScene(takeNext()); }); };
    art.src = '../assets/' + s.board;
    var list = $('clueList'); list.replaceChildren();
    s.targets.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = t.clue; b.dataset.id = t.id;
      b.addEventListener('click', function () { if (!running) start(); if (running) { assisted = true; find(t); } });
      list.appendChild(b);
    });
    $('msg').textContent = '';
  }

  function mark(t, cls) {
    var m = document.createElement('span');
    m.className = 'mark' + (cls ? ' ' + cls : '');
    var size = Math.max(t.hit.w, t.hit.h * 2 / 3) * 1.35;
    m.style.left = (t.hit.x + t.hit.w / 2) * 100 + '%';
    m.style.top = (t.hit.y + t.hit.h / 2) * 100 + '%';
    m.style.width = size * 100 + '%';
    m.style.aspectRatio = '1';
    board.appendChild(m);
    return m;
  }

  function find(t) {
    if (!running || found.has(t.id)) return;
    found.add(t.id);
    board.querySelectorAll('.mark.hint').forEach(function (m) { m.remove(); });
    mark(t);
    var c = $('clueList').querySelector('[data-id="' + t.id + '"]'); if (c) c.disabled = true;
    $('count').textContent = String(found.size);
    if (found.size === 5) { react('all_found'); finish(); } else react('found');
  }

  function finish() {
    settle(); running = false; finished = true;
    $('pause').hidden = true;
    var s = scenes[index], sec = elapsed / 1000, key = 'kb-spot-best:' + s.version;
    var best = read(key, null), isNew = false;
    if (!assisted && (best === null || sec < best)) { write(key, sec); best = sec; isNew = true; }
    $('score').textContent = 'Your time: ' + sec.toFixed(1) + ' seconds' + (assisted ? ' (with help)' : '');
    $('best').textContent = assisted
      ? (best === null ? 'Rounds with clues or hints don’t set a best time. Try it on your own next time!' : 'Best on this device: ' + best.toFixed(1) + ' seconds. Rounds with help don’t change it.')
      : (isNew ? 'New best on this device! ' : 'Best on this device: ') + best.toFixed(1) + ' seconds';
    $('results').hidden = false;
    $('msg').textContent = '';
  }

  // ---------- Tapping the picture: exact hit boxes, grown to 44px for little fingers, nearest wins ----------
  var down = null;
  board.addEventListener('pointerdown', function (e) {
    down = { x: e.clientX, y: e.clientY, sl: view.scrollLeft, st: view.scrollTop, drag: false, mouse: e.pointerType === 'mouse' };
  });
  board.addEventListener('pointermove', function (e) {
    if (!down) return;
    var dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (Math.abs(dx) + Math.abs(dy) > 8) down.drag = true;
    if (down.drag && down.mouse && board.classList.contains('zoomed')) { view.scrollLeft = down.sl - dx; view.scrollTop = down.st - dy; }
  });
  board.addEventListener('pointerup', function (e) {
    var d = down; down = null;
    if (!d || d.drag || !running) return;
    var r = board.getBoundingClientRect();
    var nx = (e.clientX - r.left) / r.width, ny = (e.clientY - r.top) / r.height;
    var px = 22 / r.width, py = 22 / r.height, bestT = null, bestD = Infinity;
    scenes[index].targets.forEach(function (t) {
      var cx = t.hit.x + t.hit.w / 2, cy = t.hit.y + t.hit.h / 2;
      var hw = Math.max(t.hit.w / 2, px), hh = Math.max(t.hit.h / 2, py);
      if (Math.abs(nx - cx) <= hw && Math.abs(ny - cy) <= hh) {
        var dist = Math.hypot((nx - cx) * r.width, (ny - cy) * r.height);
        if (dist < bestD) { bestD = dist; bestT = t; }
      }
    });
    if (bestT) find(bestT);
  });
  board.addEventListener('pointercancel', function () { down = null; });

  // ---------- Controls ----------
  $('pause').addEventListener('click', function () { if (running) pause(); else resume(); });
  $('next').addEventListener('click', function () { loadScene(takeNext()); });
  $('again').addEventListener('click', function () { loadScene(takeNext()); });
  $('hint').addEventListener('click', function () {
    if (!running) return;
    var t = scenes[index].targets.find(function (x) { return !found.has(x.id); });
    if (!t) return;
    assisted = true;
    board.querySelectorAll('.mark.hint').forEach(function (m) { m.remove(); });
    var m = mark(t, 'hint');
    $('msg').textContent = 'Clue: ' + t.clue.charAt(0).toLowerCase() + t.clue.slice(1) + '.';
    if (board.classList.contains('zoomed')) m.scrollIntoView({ block: 'center', inline: 'center' });
    setTimeout(function () { m.remove(); }, 3500);
  });
  $('zoom').addEventListener('click', function () {
    var big = board.classList.toggle('zoomed');
    $('zoom').setAttribute('aria-pressed', big ? 'true' : 'false');
    $('zoom').textContent = big ? 'Zoom out' : 'Zoom in';
    if (big) { view.scrollLeft = (view.scrollWidth - view.clientWidth) / 2; view.scrollTop = (view.scrollHeight - view.clientHeight) / 2; }
  });
  function soundLabel() { $('sound').textContent = sound ? 'Sound on' : 'Sound off'; $('sound').setAttribute('aria-pressed', sound ? 'true' : 'false'); }
  $('sound').addEventListener('click', function () { sound = !sound; clip.muted = !sound; write('kb-spot-sound', sound); soundLabel(); });
  soundLabel();
  $('reset').addEventListener('click', function () {
    var was = running; if (was) pause();
    if (window.confirm('Clear the best times and picture order saved in this browser?')) {
      clearAll(); write('kb-spot-sound', sound);
      $('msg').textContent = 'Saved scores cleared from this browser.';
    }
  });

  // Pause when the tab is hidden or the picture is scrolled mostly out of sight
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause('Paused while you were away.'); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.intersectionRatio < 0.3) pause('Paused while the picture was out of sight.'); });
    }, { threshold: [0, 0.3] }).observe(view);
  }

  // Read-only hooks for automated checks
  window.kbSpot = { scene: function () { return scenes[index]; }, found: function () { return found.size; }, running: function () { return running; } };

  fetch('../assets/scenes.json').then(function (r) { return r.json(); }).then(function (data) {
    scenes = data.scenes;
    loadScene(takeNext());
  }).catch(function () { showCover('The game could not load. Please refresh the page.', '', null); });
})();
