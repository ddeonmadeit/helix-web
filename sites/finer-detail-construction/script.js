// Theme toggle — persists in localStorage, dark default.
(function () {
  var root = document.documentElement;
  var btn = document.getElementById('themeToggle');
  if (!btn) return;

  function setLabel() {
    var t = root.getAttribute('data-theme') || 'dark';
    btn.setAttribute('aria-label', 'Switch to ' + (t === 'dark' ? 'light' : 'dark') + ' theme');
    btn.setAttribute('aria-pressed', t === 'light' ? 'true' : 'false');
  }
  setLabel();

  btn.addEventListener('click', function () {
    var next = (root.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    setLabel();
  });
})();

// Year stamp.
var y = document.getElementById('year');
if (y) y.textContent = new Date().getFullYear();

// Reveal-on-scroll.
(function () {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('is-in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
})();
