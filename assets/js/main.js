/* =========================================================================
   austinwilkins.dev — no dependencies, no build step.
   Theme toggle · typewriter · scroll reveals · nav state · footer year
   ========================================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- theme -------------------------------------------------- */
  var root = document.documentElement;
  var toggle = document.getElementById('theme-toggle');

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    if (toggle) {
      toggle.setAttribute('aria-label',
        theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#121418' : '#faf9f7');
  }

  // dark is the design default; a stored choice wins, and the head script has
  // already applied it before first paint. This just syncs the button label.
  var stored = null;
  try { stored = localStorage.getItem('theme'); } catch (e) { /* private mode */ }
  applyTheme(stored || root.getAttribute('data-theme') || 'dark');

  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem('theme', next); } catch (e) { /* ignore */ }
    });
  }

  /* ---------- typewriter --------------------------------------------- */
  var PHRASES = [
    'build platforms that run at the edge',
    'write Python that removes manual work',
    'ship software that holds up in production',
    'care about the details users never see'
  ];

  var out = document.getElementById('typewriter');
  if (out) {
    if (reduceMotion) {
      out.textContent = PHRASES[0];
    } else {
      var pi = 0, ci = 0, deleting = false;

      (function tick() {
        var phrase = PHRASES[pi];
        ci += deleting ? -1 : 1;
        out.textContent = phrase.slice(0, ci);

        var delay = deleting ? 28 : 55;
        if (!deleting && ci === phrase.length) { deleting = true; delay = 2100; }
        else if (deleting && ci === 0) { deleting = false; pi = (pi + 1) % PHRASES.length; delay = 320; }

        setTimeout(tick, delay);
      })();
    }
  }

  /* ---------- scroll reveals ------------------------------------------ */
  var revealables = document.querySelectorAll('.reveal');

  if (!('IntersectionObserver' in window) || reduceMotion) {
    // safety net: never leave content invisible
    Array.prototype.forEach.call(revealables, function (el) { el.classList.add('is-visible'); });
  } else {
    // Hand the element back to normal CSS once it has finished revealing.
    // Leaving .reveal on would keep out-specifying hover rules, and leaving the
    // inline delay on would postpone every later transition by up to 300ms.
    function settle(el) {
      el.classList.remove('reveal', 'is-visible');
      el.style.transitionDelay = '';
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.classList.add('is-visible');
        io.unobserve(el);

        var timer;
        function done() {
          clearTimeout(timer);
          el.removeEventListener('transitionend', done);
          settle(el);
        }
        el.addEventListener('transitionend', done);
        timer = setTimeout(done, 1600);   // fallback if transitionend never fires
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });

    Array.prototype.forEach.call(revealables, function (el) {
      // Stagger by position among revealing siblings, not by global index, so
      // each grid and section cascades on its own instead of every element
      // past the fifth sharing one flat delay.
      var group = Array.prototype.filter.call(el.parentNode.children, function (c) {
        return c.classList && c.classList.contains('reveal');
      });
      var i = group.indexOf(el);
      el.style.transitionDelay = (Math.min(i < 0 ? 0 : i, 5) * 60) + 'ms';
      io.observe(el);
    });

    // belt and braces: if anything above the fold is still hidden after load, show it
    window.addEventListener('load', function () {
      setTimeout(function () {
        document.querySelectorAll('.reveal:not(.is-visible)').forEach(function (el) {
          if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-visible');
        });
      }, 400);
    });
  }

  /* ---------- nav: stuck border + active section ---------------------- */
  var nav = document.getElementById('nav');
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav__links a'));
  var sections = links
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  function onScroll() {
    if (nav) nav.classList.toggle('is-stuck', window.scrollY > 8);

    var pos = window.scrollY + 120;
    var current = null;
    sections.forEach(function (sec) { if (sec.offsetTop <= pos) current = sec.id; });

    links.forEach(function (a) {
      a.classList.toggle('is-active', a.getAttribute('href') === '#' + current);
    });
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () { onScroll(); ticking = false; });
  }, { passive: true });
  onScroll();

  /* ---------- footer year --------------------------------------------- */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
