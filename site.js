(() => {
  'use strict';
  const { materials, projects } = window.CATALOGO;
  const $ = (s) => document.querySelector(s);
  const mobile = matchMedia('(max-width:700px)');
  const state = { material: { category: 'Todos', query: '', page: 1 }, project: { category: 'Todos', page: 1 } };
  const dialog = $('#detail-dialog');
  const descriptions = {
    Granitos: 'Cores e desenhos naturais para compor o seu ambiente. Converse com a nossa equipe sobre o acabamento e a indicação para o seu projeto.',
    Escovados: 'Uma superfície de aspecto fosco e textura marcante. Conheça de perto o acabamento escovado e suas possibilidades.',
    Mármores: 'Veios e nuances que valorizam cada peça. Nossa equipe ajuda a avaliar a escolha conforme o ambiente e a rotina de uso.',
    Prime: 'Superfície composta à base de mármore, com uma proposta visual uniforme. Consulte nossa equipe sobre os usos e cuidados indicados.',
    'Ônix': 'Desenhos e transparências que destacam a beleza do material. Converse com a Kairós sobre as possibilidades para o seu ambiente.',
    Quartzos: 'Uma seleção de cores e padrões apresentada na categoria Quartzos do catálogo. Consulte as especificações e os cuidados de cada opção.'
  };
  function route(focus = true) {
    const requested = location.hash.slice(1) || 'inicio';
    const id = ['inicio', 'materiais', 'projetos', 'estudio', 'contato'].includes(requested) ? requested : 'inicio';
    document.querySelectorAll('.view').forEach((view) => { view.hidden = view.id !== id; });
    document.querySelectorAll('.header nav a').forEach((a) => {
      if (a.hash === '#' + id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const names = { inicio: 'Marmoraria em Artur Nogueira', materiais: 'Materiais do catálogo', projetos: 'Ambientes e projetos', estudio: 'Estúdio 3D', contato: 'A Kairós e contato' };
    document.title = id === 'inicio' ? 'Marmoraria Kairós | Artur Nogueira – SP' : names[id] + ' | Marmoraria Kairós';
    if (dialog.open) dialog.close();
    if (focus) {
      document.querySelector('#' + id + ' h1').focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }
  function openDetail(item, type) {
    $('#detail-image').src = item.image;
    $('#detail-image').alt = type === 'material' ? 'Amostra de ' + item.name : item.name + ' — imagem do catálogo';
    $('#detail-category').textContent = item.category + ' · Catálogo Kairós';
    $('#detail-title').textContent = item.name;
    $('#detail-description').textContent = type === 'material' ? descriptions[item.category] : 'Referência de ambiente apresentada no catálogo Kairós. Compartilhe esta inspiração com a nossa equipe para conversar sobre o seu projeto.';
    $('#detail-note').textContent = type === 'material' ? 'Imagem de referência. Cores e veios podem variar entre peças e telas. Confirme a amostra, a disponibilidade e a aplicação com a equipe.' : 'A imagem faz parte da seleção do catálogo. Materiais, medidas e acabamentos do seu projeto serão definidos no atendimento.';
    $('#detail-whatsapp').textContent = type === 'material' ? 'Consultar este material ↗' : 'Conversar sobre meu projeto ↗';
    // Number already present in the original site; the catalogue's direct link is kept on general CTAs.
    $('#detail-whatsapp').href = 'https://wa.me/5519997968365?text=' + encodeURIComponent('Olá, Kairós! Vi ' + (type === 'material' ? 'o material ' : 'a referência ') + item.name + ' no catálogo e gostaria de conversar sobre meu projeto.');
    dialog.showModal();
    document.body.style.overflow = 'hidden';
  }
  function filtered(type) {
    const s = state[type], source = type === 'material' ? materials : projects;
    const normalize = (v) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return source.filter((item) => (s.category === 'Todos' || item.category === s.category) && (!s.query || normalize(item.name).includes(normalize(s.query))));
  }
  function render(type, focusGrid = false) {
    const s = state[type], items = filtered(type), size = type === 'material' ? (mobile.matches ? 4 : 6) : 4;
    const pages = Math.max(1, Math.ceil(items.length / size));
    s.page = Math.min(s.page, pages);
    const start = (s.page - 1) * size;
    const grid = $('#' + type + '-grid');
    grid.replaceChildren();
    items.slice(start, start + size).forEach((item) => {
      const card = document.createElement('button');
      card.className = type + '-card';
      card.setAttribute('aria-label', 'Ver ' + item.name);
      const img = document.createElement('img');
      img.src = item.image; img.alt = ''; img.loading = 'lazy'; img.width = 500; img.height = type === 'material' ? 220 : 600;
      const copy = document.createElement('div'); copy.className = 'card-copy';
      const text = document.createElement('div');
      const heading = document.createElement('h2'); heading.textContent = item.name;
      const category = document.createElement('p'); category.textContent = item.category;
      const arrow = document.createElement('span'); arrow.className = 'card-arrow'; arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true');
      text.append(heading, category); copy.append(text, arrow); card.append(img, copy);
      card.addEventListener('click', () => openDetail(item, type)); grid.append(card);
    });
    $('#' + type + '-count').textContent = items.length ? `${start + 1}–${Math.min(start + size, items.length)} de ${items.length} ${type === 'material' ? 'materiais' : 'ambientes'}` : 'Nenhum material encontrado';
    if (type === 'material') $('#material-empty').hidden = items.length > 0;
    const nav = $('#' + type + '-pages'); nav.replaceChildren(); nav.hidden = pages <= 1;
    function pageButton(label, page, disabled, current, aria) {
      const b = document.createElement('button'); b.textContent = label; b.disabled = disabled;
      b.setAttribute('aria-label', aria);
      if (current) b.setAttribute('aria-current', 'page');
      b.addEventListener('click', () => { s.page = page; render(type, true); }); nav.append(b);
    }
    pageButton('←', s.page - 1, s.page === 1, false, 'Página anterior');
    const pageInfo = document.createElement('span'); pageInfo.textContent = `Página ${s.page} de ${pages}`; nav.append(pageInfo);
    pageButton('→', s.page + 1, s.page === pages, false, 'Próxima página');
    if (focusGrid && grid.firstElementChild) { grid.firstElementChild.focus({ preventScroll: true }); grid.scrollIntoView({ block: 'nearest' }); }
  }
  function setupFilters(type, source) {
    const box = $('#' + type + '-filters');
    ['Todos', ...new Set(source.map((item) => item.category))].forEach((category) => {
      const button = document.createElement('button'); button.textContent = category;
      button.setAttribute('aria-pressed', String(category === 'Todos'));
      button.addEventListener('click', () => {
        state[type].category = category; state[type].page = 1;
        box.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
        render(type);
      }); box.append(button);
    });
  }
  document.getElementById('discover-home').addEventListener('click', () => {
    document.getElementById('home-discover').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  });
  document.querySelectorAll('[data-home-material]').forEach((button) => {
    button.addEventListener('click', () => {
      const item = materials.find((material) => material.name === button.dataset.homeMaterial);
      if (item) openDetail(item, 'material');
    });
  });
  setupFilters('material', materials); setupFilters('project', projects);
  $('#material-search').addEventListener('input', (e) => { state.material.query = e.target.value.trim(); state.material.page = 1; render('material'); });
  $('#clear-search').addEventListener('click', () => {
    $('#material-search').value = ''; state.material.query = ''; $('#material-filters button').click(); $('#material-search').focus();
  });
  $('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
  dialog.addEventListener('close', () => { document.body.style.overflow = ''; });
  window.addEventListener('hashchange', () => route());
  mobile.addEventListener('change', () => { state.material.page = 1; render('material'); });
  $('#year').textContent = new Date().getFullYear();
  render('material'); render('project'); route(false);
})();
