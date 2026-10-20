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
      if (fundo) fundo.appendChild(frame);
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
      // A lupa pede o WebP; se o navegador nao ler o formato, cai no JPEG.
      // Uma tentativa so: sem a trava, um arquivo mesmo ausente entraria em
      // laco, pedindo a reserva, falhando e pedindo de novo.
      var reserva = f.getAttribute('data-full-reserva');
      img.onerror = function () {
        img.onerror = null;
        if (reserva && img.src !== reserva) img.src = reserva;
      };
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

  /* --- Perfil do público: faixas como abas ------------------------------
     O primeiro projeto já vem aberto, então quem chega sem JavaScript, ou
     antes dele rodar, lê um perfil completo em vez de um bloco vazio. */
  var pfGrafico = document.querySelector('.pf-grafico[role="tablist"]');
  if (pfGrafico) {
    var abas = Array.prototype.slice.call(pfGrafico.querySelectorAll('[role="tab"]'));

    var escolher = function (i, focar) {
      i = (i + abas.length) % abas.length;
      abas.forEach(function (aba, j) {
        var ativa = j === i;
        aba.setAttribute('aria-selected', ativa ? 'true' : 'false');
        aba.tabIndex = ativa ? 0 : -1;
        var painel = document.getElementById(aba.getAttribute('aria-controls'));
        if (painel) painel.hidden = !ativa;
      });
      if (focar) abas[i].focus();
    };

    abas.forEach(function (aba, i) {
      aba.addEventListener('click', function () { escolher(i, false); });
      aba.addEventListener('keydown', function (ev) {
        if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') { ev.preventDefault(); escolher(i + 1, true); }
        else if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') { ev.preventDefault(); escolher(i - 1, true); }
        else if (ev.key === 'Home') { ev.preventDefault(); escolher(0, true); }
        else if (ev.key === 'End') { ev.preventDefault(); escolher(abas.length - 1, true); }
      });
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

  /* Troca a capa pelo player. mudo diz se entra sem som: o navegador so deixa
     tocar sozinho quando esta mudo, entao a entrada automatica e muda e a do
     clique tem som. foco so faz sentido quando houve clique — mover o foco
     sozinho tiraria a pessoa de onde ela estava lendo. */
  function abrir(botao, mudo) {
    if (!botao.parentNode) return;
    var frame = document.createElement('iframe');
    frame.src = botao.dataset.embed + '?autoplay=1&rel=0&playsinline=1'
              + (mudo ? '&mute=1' : '');
    frame.title = botao.dataset.titulo || 'Vídeo';
    frame.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture';
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    frame.setAttribute('allowfullscreen', '');
    botao.parentNode.replaceChild(frame, botao);
    if (!mudo) frame.focus();
  }

  facades.forEach(function (botao) {
    botao.addEventListener('click', function () { abrir(botao, false); });
  });

  /* O video comeca sozinho quando entra na tela. Quem pediu menos movimento no
     sistema continua com a capa e o botao: a preferencia do sistema vale mais
     que a vontade da pagina. Sem IntersectionObserver, idem. */
  var paradoQuieto = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (facades.length && !paradoQuieto && 'IntersectionObserver' in window) {
    var olho = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (ent) {
        if (!ent.isIntersecting) return;
        olho.unobserve(ent.target);
        abrir(ent.target, true);
      });
    }, { threshold: 0.5 });
    facades.forEach(function (botao) { olho.observe(botao); });
  }

  /* --- Formulários do Relacionamento -------------------------------------
     O site é estático: não há servidor para receber post. O envio monta um
     e-mail com rótulo e resposta de cada campo preenchido, na ordem do
     formulário, e abre o programa de e-mail de quem preencheu. Chega legível
     e a pessoa vê o que mandou antes de enviar.

     Campo marcado com data-so-se só aparece quando o campo que ele cita
     assume o valor esperado: quem vem oferecer um show não lê as perguntas
     de atleta. Enquanto escondido, ele também perde o "required", senão o
     navegador barraria o envio por um campo que ninguém vê. */
  [].slice.call(document.querySelectorAll('.form-rel')).forEach(function (form) {
    var condicionais = [].slice.call(form.querySelectorAll('[data-so-se]'));

    function sincroniza() {
      condicionais.forEach(function (campo) {
        var gatilho = document.getElementById(campo.getAttribute('data-so-se'));
        var mostra = gatilho && gatilho.value === campo.getAttribute('data-valor');
        campo.hidden = !mostra;
        [].slice.call(campo.querySelectorAll('input,select,textarea')).forEach(function (el) {
          el.disabled = !mostra;
        });
      });
    }

    form.addEventListener('change', sincroniza);
    sincroniza();

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var linhas = [];
      [].slice.call(form.querySelectorAll('input,select,textarea')).forEach(function (el) {
        if (el.disabled || !el.name) return;
        var v = (el.value || '').trim();
        if (v) linhas.push(el.name + ': ' + v);
      });
      if (!linhas.length) return;
      var assunto = form.getAttribute('data-assunto') || 'Contato pelo site';
      window.location.href = 'mailto:' + form.getAttribute('data-caixa')
        + '?subject=' + encodeURIComponent('[Site] ' + assunto)
        + '&body=' + encodeURIComponent(linhas.join('\n'));
    });
  });

})();
