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

  /* --- Herói da home: vídeo de fundo ------------------------------------
     O iframe é inserido por aqui, e não pelo HTML, por três razões:
     quem prefere menos movimento não recebe o player nem a requisição ao
     YouTube; a janela já tem tamanho conhecido quando ele entra, o que evita
     um reflow na primeira pintura; e o domínio sem cookie é usado sempre.
     Falhando qualquer coisa, o herói permanece preto com a tipografia branca. */
  var cena = document.querySelector('.hero-cine');
  if (cena) {
    var id = cena.getAttribute('data-video');
    var menos = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    if (id && !(menos && menos.matches)) {
      var params = [
        'autoplay=1', 'mute=1', 'loop=1', 'playlist=' + id,
        // nada de controles, teclado, tela cheia, legendas, anotações,
        // marca do player nem vídeos sugeridos: só a imagem correndo
        'controls=0', 'disablekb=1', 'fs=0', 'modestbranding=1',
        'rel=0', 'playsinline=1', 'iv_load_policy=3',
        'cc_load_policy=0', 'showinfo=0', 'autohide=1'
      ].join('&');
      var frame = document.createElement('iframe');
      frame.src = 'https://www.youtube-nocookie.com/embed/' + id + '?' + params;
      frame.title = 'Vídeo institucional da Cadillac, sem som, ao fundo';
      frame.setAttribute('allow', 'autoplay; encrypted-media');
      frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      frame.setAttribute('tabindex', '-1');
      frame.setAttribute('aria-hidden', 'true');
      frame.loading = 'eager';
      var fundo = cena.querySelector('.hero-fundo');
      if (fundo) {
        fundo.appendChild(frame);

        // O vazado da manchete só entra quando o YouTube responde de fato.
        // Nem a inserção do iframe nem o seu evento 'load' servem de prova: o
        // navegador dispara 'load' também na página de erro de uma conexão
        // recusada. Por isso a sonda é uma imagem do CDN do YouTube — ela só
        // carrega se o domínio estiver mesmo acessível.
        // Sem essa confirmação o fundo fica preto, e uma palavra vazada em
        // preto sobre véu escuro desapareceria. Nesse caso ela segue laranja.
        var sonda = new Image();
        sonda.onload = function () { cena.classList.add('tem-video'); };
        sonda.referrerPolicy = 'no-referrer';
        sonda.src = 'https://i.ytimg.com/vi/' + id + '/default.jpg';
      }
    }
  }

  /* --- Lupa da galeria ---------------------------------------------------
     A ampliação é construída aqui, e não no HTML de 34 páginas: um só nó
     serve a todas as galerias. Fecha no Esc, no clique fora e no botão; as
     setas andam pelas fotos; o foco volta para a miniatura de origem. */
  var galerias = document.querySelectorAll('.gal-grid');
  if (galerias.length) {
    var fotos = [], atual = 0, origem = null;

    var lupa = document.createElement('div');
    lupa.className = 'lupa';
    lupa.setAttribute('role', 'dialog');
    lupa.setAttribute('aria-modal', 'true');
    lupa.setAttribute('aria-label', 'Foto ampliada');
    lupa.innerHTML =
      '<button type="button" class="lupa-fechar" aria-label="Fechar">' +
      '<span aria-hidden="true" class="material-symbols-outlined cd-icon">close</span></button>' +
      '<button type="button" class="lupa-nav lupa-ant" aria-label="Foto anterior">' +
      '<span aria-hidden="true" class="material-symbols-outlined cd-icon">arrow_back</span></button>' +
      '<button type="button" class="lupa-nav lupa-prox" aria-label="Próxima foto">' +
      '<span aria-hidden="true" class="material-symbols-outlined cd-icon">arrow_forward</span></button>' +
      '<div class="lupa-caixa"><img alt=""><p class="lupa-pe"></p></div>';
    document.body.appendChild(lupa);

    var img = lupa.querySelector('img');
    var pe = lupa.querySelector('.lupa-pe');
    var ant = lupa.querySelector('.lupa-ant');
    var prox = lupa.querySelector('.lupa-prox');

    var mostrar = function (i) {
      if (!fotos.length) return;
      atual = (i + fotos.length) % fotos.length;
      var f = fotos[atual];
      img.src = f.getAttribute('data-full');
      img.alt = f.getAttribute('data-legenda') || '';
      pe.textContent = f.getAttribute('data-credito') +
        '  ·  ' + (atual + 1) + ' de ' + fotos.length;
      var so = fotos.length < 2;
      ant.hidden = so;
      prox.hidden = so;
    };

    var fechar = function () {
      lupa.classList.remove('aberta');
      document.body.style.overflow = '';
      if (origem) { origem.focus(); origem = null; }
    };

    var abrir = function (grade, botao) {
      fotos = Array.prototype.slice.call(grade.querySelectorAll('.gal-item[data-full]'));
      origem = botao;
      mostrar(fotos.indexOf(botao));
      lupa.classList.add('aberta');
      document.body.style.overflow = 'hidden';
      lupa.querySelector('.lupa-fechar').focus();
    };

    Array.prototype.forEach.call(galerias, function (grade) {
      grade.addEventListener('click', function (ev) {
        var botao = ev.target.closest ? ev.target.closest('.gal-item[data-full]') : null;
        if (botao) abrir(grade, botao);
      });
    });

    lupa.querySelector('.lupa-fechar').addEventListener('click', fechar);
    ant.addEventListener('click', function () { mostrar(atual - 1); });
    prox.addEventListener('click', function () { mostrar(atual + 1); });
    lupa.addEventListener('click', function (ev) { if (ev.target === lupa) fechar(); });
    document.addEventListener('keydown', function (ev) {
      if (!lupa.classList.contains('aberta')) return;
      if (ev.key === 'Escape') fechar();
      else if (ev.key === 'ArrowLeft') mostrar(atual - 1);
      else if (ev.key === 'ArrowRight') mostrar(atual + 1);
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

/* Player de vídeo sob demanda: o embed de terceiro só entra depois do clique. */
(function () {
  var facades = [].slice.call(document.querySelectorAll('.video-facade'));
  facades.forEach(function (botao) {
    botao.addEventListener('click', function () {
      var frame = document.createElement('iframe');
      frame.src = botao.dataset.embed + '?autoplay=1&rel=0';
      frame.title = botao.dataset.titulo || 'Vídeo';
      frame.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture';
      frame.setAttribute('allowfullscreen', '');
      botao.parentNode.replaceChild(frame, botao);
      frame.focus();
    });
  });
})();
