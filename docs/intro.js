/* Letter reveal and light sweep recovered from the original Kairós opening. */
(() => {
  const intro = document.getElementById('brand-intro');
  if (!intro || typeof intro.showModal !== 'function') return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const letters = document.getElementById('opening-letters');
  let index = 0;
  letters.replaceChildren();
  'MARMORARIA KAIRÓS'.split(' ').forEach((word) => {
    const group = document.createElement('span');
    group.className = 'opening-word';
    for (const character of word) {
      const letter = document.createElement('span');
      letter.textContent = character;
      letter.style.setProperty('--letter-delay', `${700 + index++ * 240}ms`);
      group.append(letter);
    }
    letters.append(group);
  });
  let timer;
  function finish() { if (intro.open) intro.close(); }
  intro.addEventListener('close', () => {
    clearTimeout(timer);
    document.documentElement.classList.remove('opening-active');
    intro.remove();
  }, { once: true });
  document.getElementById('opening-skip').addEventListener('click', finish);
  document.getElementById('opening-enter').addEventListener('click', finish);
  window.addEventListener('hashchange', finish, { once: true });
  reduced.addEventListener('change', finish, { once: true });
  try {
    intro.showModal();
    document.documentElement.classList.add('opening-active');
    timer = setTimeout(finish, 10000);
  } catch (_) { intro.remove(); }
})();

