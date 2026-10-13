// Kaboombit family websites: menu, movie players, the hero film and Kaboomby's magic opening. No tracking.
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var calm = !!(reduce && reduce.matches);
  function store(kind) { try { var s = window[kind]; s.setItem('kb-t', '1'); s.removeItem('kb-t'); return s; } catch (e) { return null; } }
  var session = store('sessionStorage');

  var btn = document.querySelector('.menu-btn');
  var nav = document.getElementById('nav');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
    });
  }

  // Only one video plays at a time across the page
  function pauseOthers(keep) {
    document.querySelectorAll('video').forEach(function (o) { if (o !== keep && !o.paused) o.pause(); });
  }
  document.addEventListener('play', function (e) { if (e.target.tagName === 'VIDEO') pauseOthers(e.target); }, true);

  // Click-to-play movie players
  document.querySelectorAll('.player').forEach(function (p) {
    var v = p.querySelector('video'), play = p.querySelector('.play'), mute = p.querySelector('.mute');
    if (!v || !play) return;
    play.addEventListener('click', function () { v.controls = true; var r = v.play(); if (r && r.catch) r.catch(function () {}); });
    v.addEventListener('play', function () { p.classList.add('playing', 'started'); });
    v.addEventListener('pause', function () { p.classList.remove('playing'); });
    v.addEventListener('ended', function () { p.classList.remove('playing'); });
    if (mute) mute.addEventListener('click', function () {
      v.muted = !v.muted;
      mute.textContent = v.muted ? 'Sound off' : 'Sound on';
      mute.setAttribute('aria-pressed', v.muted ? 'true' : 'false');
    });
  });

  // kaboombit.com hero film: silent, plays once when visible (never with reduced motion), poster otherwise
  var frame = document.getElementById('film');
  if (frame) {
    var film = frame.querySelector('video');
    var pauseBtn = frame.querySelector('[data-pause]');
    var played = false;
    function showFailed() { frame.classList.remove('playing', 'started'); if (asked) frame.classList.add('failed'); }
    var asked = false;
    function go(fromStart, byUser) {
      if (byUser) asked = true;
      frame.classList.remove('failed');
      if (fromStart) { try { film.currentTime = 0; } catch (e) {} }
      if (film.networkState === 3) { showFailed(); return; }
      if (film.preload === 'none') { film.preload = 'auto'; film.load(); }
      if (byUser) setTimeout(function () { if (film.paused && film.readyState < 3) showFailed(); }, 5000);
      var r = film.play();
      if (r && r.catch) r.catch(function (err) { if (!err || err.name !== 'AbortError') showFailed(); });
    }
    var sources = film.querySelectorAll('source');
    if (sources.length) sources[sources.length - 1].addEventListener('error', showFailed);
    film.addEventListener('error', showFailed);
    film.addEventListener('play', function () { played = true; frame.classList.add('playing', 'started'); pauseBtn.textContent = 'Pause'; pauseBtn.setAttribute('aria-pressed', 'false'); });
    film.addEventListener('pause', function () { frame.classList.remove('playing'); pauseBtn.textContent = 'Play'; pauseBtn.setAttribute('aria-pressed', 'true'); });
    film.addEventListener('ended', function () { frame.classList.remove('playing'); pauseBtn.textContent = 'Play'; });
    pauseBtn.addEventListener('click', function () { if (film.paused) go(false, true); else film.pause(); });
    frame.querySelector('[data-replay]').addEventListener('click', function () { go(true, true); });
    document.querySelectorAll('[data-watch]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.closest('#film') == null) frame.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
        go(true, true);
      });
    });
    if (!calm && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting && e.intersectionRatio > 0.6 && !played) { played = true; go(true); io.disconnect(); }
        });
      }, { threshold: [0, 0.6] });
      io.observe(frame);
    }
    document.addEventListener('visibilitychange', function () { if (document.hidden && !film.paused) film.pause(); });
  }

  // kaboomby.com opening: tap "Show me the magic!" to play Abra A with sound, then reveal the headline and links
  var theatre = document.querySelector('.theatre');
  if (theatre) {
    var holder = theatre.querySelector('.kb-player');
    var still = holder.querySelector('img');
    var line = theatre.querySelector('.caption-line');
    var clip = null;
    // Transparent WebM works in Chrome, Edge, Firefox and Android. Safari and every iPhone browser get the purple-backed MP4.
    var ua = navigator.userAgent;
    var webkitOnly = /iP(hone|ad|od)/.test(ua) || (/Safari\//.test(ua) && !/(Chrome|Chromium|CriOS|Edg|Firefox|FxiOS|OPR)\//.test(ua)) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var alphaOk = !webkitOnly && document.createElement('video').canPlayType('video/webm; codecs="vp9, opus"') !== '';
    if (!alphaOk) { theatre.classList.add('no-alpha'); still.src = holder.dataset.stillMp4; }
    function settle(msg) {
      if (clip) clip.pause();
      holder.classList.remove('on');
      theatre.classList.remove('playing');
      theatre.classList.add('done');
      line.textContent = msg || '';
      if (session) session.setItem('kb-magic-seen', '1');
    }
    function magic() {
      if (calm) { settle('Abra Kaboombit!'); return; }
      if (!clip) {
        clip = document.createElement('video');
        clip.playsInline = true; clip.setAttribute('playsinline', '');
        clip.preload = 'auto';
        clip.src = alphaOk ? holder.dataset.webm : holder.dataset.mp4;
        clip.setAttribute('aria-hidden', 'true');
        holder.appendChild(clip);
        clip.addEventListener('ended', function () { settle(''); });
        clip.addEventListener('error', function () { settle('The animation could not play here, but the fun is just below.'); });
      }
      theatre.classList.remove('done');
      theatre.classList.add('playing');
      line.textContent = 'Abra Kaboombit!';
      try { clip.currentTime = 0; } catch (e) {}
      clip.muted = false;
      var r = clip.play();
      holder.classList.add('on');
      if (r && r.catch) r.catch(function () { settle('Tap Replay to hear the magic words.'); });
    }
    theatre.querySelectorAll('[data-magic]').forEach(function (b) { b.addEventListener('click', magic); });
    theatre.querySelectorAll('[data-skip]').forEach(function (b) { b.addEventListener('click', function () { settle(''); }); });
    if (calm || (session && session.getItem('kb-magic-seen'))) settle('');
    document.addEventListener('visibilitychange', function () { if (document.hidden && theatre.classList.contains('playing')) settle(''); });
  }

  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
