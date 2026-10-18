/* Cadillac — comportamento do portal. Sem dependências externas. */
(function () {
  'use strict';
  document.documentElement.classList.add('has-js');

  /* --- Menu mobile ----------------------------------------------------- */
  var toggle = document.getElementById('menuToggle');
  var menu = document.getElementById('mobileNav');
  var header = document.querySelector('.site-header');

  function headerHeight() {
    return header ? Math.round(header.getBoundingClientRect().height) : 68;
  }

  if (toggle && menu) {
    var symbol = toggle.querySelector('.cd-icon');
    var setMenu = function (open) {
      menu.style.setProperty('--header-h', headerHeight() + 'px');
      menu.classList.toggle('open', open);
      document.body.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
      if (symbol) symbol.textContent = open ? 'close' : 'menu';
      if (open) {
        var first = menu.querySelector('a');
        if (first) first.focus();
      }
    };
    toggle.addEventListener('click', function () {
      setMenu(!menu.classList.contains('open'));
    });
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { setMenu(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('open')) {
        setMenu(false);
        toggle.focus();
      }
    });
    document.addEventListener('click', function (e) {
      if (!menu.classList.contains('open')) return;
      if (menu.contains(e.target) || toggle.contains(e.target)) return;
      setMenu(false);
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 1000 && menu.classList.contains('open')) setMenu(false);
    });
  }

  /* --- Header compacto e botão "voltar ao topo" ------------------------ */
  var toTop = document.querySelector('.to-top');
  var onScroll = function () {
    var y = window.pageYOffset || document.documentElement.scrollTop;
    if (header) header.classList.toggle('is-compact', y > 140);
    if (toTop) toTop.classList.toggle('show', y > 900);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* --- Âncoras: o salto ocorre antes do layout assentar ---------------- */
  var ajustarAncora = function () {
    if (!location.hash) return;
    var alvo;
    try { alvo = document.querySelector(location.hash); } catch (e) { return; }
    if (alvo) alvo.scrollIntoView();   // respeita o scroll-margin-top do CSS
  };
  window.addEventListener('load', function () {
    ajustarAncora();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustarAncora);
  });
  window.addEventListener('hashchange', ajustarAncora);

  /* --- Filtro do acervo de projetos ------------------------------------ */
  var board = document.getElementById('projectBoard');
  if (board) {
    var cards = Array.prototype.slice.call(board.querySelectorAll('[data-project]'));
    var chips = Array.prototype.slice.call(document.querySelectorAll('.chip[data-filter]'));
    var search = document.getElementById('projectSearch');
    var counter = document.getElementById('filterCount');
    var empty = document.getElementById('emptyState');
    var state = { categoria: 'todos', ano: 'todos', q: '' };

    var apply = function () {
      var visible = 0;
      cards.forEach(function (card) {
        var okCat = state.categoria === 'todos' || card.dataset.categoria === state.categoria;
        var okYear = state.ano === 'todos' || (card.dataset.anos || '').split(' ').indexOf(state.ano) > -1;
        var okText = !state.q || (card.dataset.busca || '').indexOf(state.q) > -1;
        var show = okCat && okYear && okText;
        card.hidden = !show;
        if (show) visible++;
      });
      if (counter) {
        counter.textContent = visible === cards.length
          ? cards.length + ' projetos'
          : visible + ' de ' + cards.length + ' projetos';
      }
      if (empty) empty.classList.toggle('show', visible === 0);
    };

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var group = chip.dataset.filter;
        chips.filter(function (c) { return c.dataset.filter === group; })
          .forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
        state[group] = chip.dataset.value;
        apply();
      });
    });
    if (search) {
      search.addEventListener('input', function () {
        state.q = search.value.trim().toLowerCase();
        apply();
      });
    }
    apply();
  }
})();
