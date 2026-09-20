(() => {
  const view = document.getElementById('estudio');
  const status = document.getElementById('studio-status');
  let loading = false;
  let studio = null;
  function fallback() {
    view.dataset.ready = 'fallback';
    status.textContent = 'A visualização 3D não está disponível neste dispositivo. Explore as imagens e os materiais do catálogo.';
    document.getElementById('studio-fallback').hidden = false;
    document.getElementById('studio-canvas').hidden = true;
    document.getElementById('studio-controls').hidden = true;
  }
  function update() {
    const active = location.hash === '#estudio';
    if (studio) { studio.setActive(active); return; }
    if (!active || loading) return;
    loading = true;
    status.textContent = 'Preparando o estúdio 3D…';
    const script = document.createElement('script');
    script.src = 'studio-3d.js';
    script.onload = () => {
      try {
        studio = window.createKairosStudio();
        view.dataset.ready = 'true';
        studio.setActive(location.hash === '#estudio');
      } catch (error) { fallback(); }
    };
    script.onerror = fallback;
    document.head.append(script);
  }
  document.addEventListener('studio-unavailable', fallback);
  window.addEventListener('hashchange', update);
  update();
})();
