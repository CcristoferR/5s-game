/* ClassPlay · mejora progresiva.
 * El contenido y los enlaces siguen disponibles sin las librerías de animación.
 * La landing no consulta Supabase ni ejecuta el juego. */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const config = window.CLASSPLAY_CONFIG || {};
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  let lenis = null;
  let menuTween = null;

  // Configuración pública de marca y recursos pendientes.
  const validColor = (value) => typeof value === 'string' && CSS.supports('color', value);
  [['accent', '--accent'], ['accentInk', '--accent-ink'], ['accentOnLight', '--accent-on-light']].forEach(([key, variable]) => {
    if (validColor(config[key])) document.documentElement.style.setProperty(variable, config[key]);
  });
  $$('[data-year]').forEach((node) => { node.textContent = String(new Date().getFullYear()); });
  if (config.mediaReady) {
    $$('[data-pending-media]').forEach((node) => { node.hidden = true; });
    $$('img[alt^="Marcador para la captura de "]').forEach((img) => { img.alt = img.alt.replace('Marcador para la captura de ', 'Captura de '); });
    $$('img[alt^="Marcador para la fase "]').forEach((img) => { img.alt = img.alt.replace('Marcador para la fase ', 'Fase '); });
  }
  if (config.brandReady) {
    $$('.brand img').forEach((img) => { img.alt = 'Logo de ClassPlay'; });
  }
  $('.phase-gallery').hidden = !config.showPhaseImages;

  // Srcset de una fuente mientras se esperan las capturas finales: reemplazar
  // el archivo base actualiza TODOS los tamaños, sin copias antiguas en móvil.
  $$('img[src$=".webp"]').forEach((img) => {
    img.srcset = `${img.getAttribute('src')} ${img.getAttribute('width')}w`;
    img.sizes = img.closest('.admin-browser') ? '(max-width: 900px) 90vw, 820px' : '(max-width: 600px) 90vw, 650px';
  });

  // Cabecera: un único estado; no fuerza mediciones en cada movimiento.
  const header = $('#cabecera');
  let scrollQueued = false;
  const updateHeader = () => { header.classList.toggle('scrolled', scrollY > 24); scrollQueued = false; };
  addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(updateHeader); } }, { passive: true });
  updateHeader();

  // Diálogo nativo: el navegador contiene el foco y bloquea el fondo.
  const menu = $('#menu-movil');
  const menuButton = $('.menu-toggle');
  const menuClose = $('.menu-close');
  const openMenu = () => {
    if (menu.open) return;
    menuTween?.kill();
    menu.showModal();
    document.body.classList.add('menu-open');
    menuButton.setAttribute('aria-expanded', 'true');
    lenis?.stop();
    if (gsap && !reducedMotion.matches) {
      gsap.set(menu, { opacity: 1, y: 0 });
      menuTween = gsap.timeline().fromTo(menu, { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: .5, ease: 'power3.out' }).fromTo($$('nav a', menu), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: .5, stagger: .06, ease: 'power3.out' }, .1);
    }
    menuClose.focus({ preventScroll: true });
  };
  const closeMenu = (restoreFocus = true, done = () => {}) => {
    if (!menu.open) { done(); return; }
    menuTween?.kill();
    const finish = () => {
      menu.close();
      document.body.classList.remove('menu-open');
      menuButton.setAttribute('aria-expanded', 'false');
      lenis?.start();
      if (restoreFocus) menuButton.focus({ preventScroll: true });
      done();
    };
    if (gsap && !reducedMotion.matches) menuTween = gsap.to(menu, { opacity: 0, y: -10, duration: .3, ease: 'power2.in', onComplete: finish });
    else finish();
  };
  menuButton.addEventListener('click', openMenu);
  menuClose.addEventListener('click', () => closeMenu());
  menu.addEventListener('cancel', (event) => { event.preventDefault(); closeMenu(); });
  matchMedia('(min-width: 901px)').addEventListener('change', (event) => { if (event.matches && menu.open) closeMenu(false); });

  // Enlaces internos: URL compartible, cabecera compensada y foco accesible.
  $$('a[href^="#"]').forEach((link) => link.addEventListener('click', (event) => {
    const id = link.getAttribute('href');
    const target = document.getElementById(id.slice(1));
    if (!target) return;
    event.preventDefault();
    const go = () => {
      if (location.hash !== id) history.pushState(null, '', id);
      if (!target.matches('input,button,a,textarea')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      // Compensa la cabecera fija y el margen propio del destino: la sección queda justo debajo, sin franjas de la anterior.
      // offsetTop ignora transformaciones, así una entrada animada en curso no desvía el destino.
      const offset = header.offsetHeight + (parseFloat(getComputedStyle(target).scrollMarginTop) || 0);
      let top = 0;
      for (let node = target; node; node = node.offsetParent) top += node.offsetTop;
      if (lenis && !reducedMotion.matches) lenis.scrollTo(Math.max(0, top - offset), { duration: 1 });
      else target.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
    };
    if (menu.open) closeMenu(false, go); else go();
  }));

  // Verificación: coincide con el router del proyecto adjunto.
  $('#verificar-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = $('#codigo-certificado');
    const code = input.value.trim();
    input.setCustomValidity(code ? '' : 'Ingresa el código del certificado.');
    if (!input.reportValidity()) return;
    location.assign(`/ingreso/#verificar/${encodeURIComponent(code)}`);
  });
  $('#codigo-certificado').addEventListener('input', (event) => event.target.setCustomValidity(''));
  addEventListener('hashchange', () => {
    if (/^#verificar(?:\/|$)/i.test(location.hash)) location.replace('/ingreso/' + location.hash);
  });

  // Pestañas: flechas, Inicio/Fin, foco itinerante y paneles de altura estable.
  const tabs = $$('.admin-tabs [role="tab"]');
  const tabList = $('.admin-tabs');
  const indicator = $('.tab-indicator');
  const panels = $$('.admin-view');
  let selectedTab = 0;
  let panelAnimation = null;
  const placeIndicator = (animate = false) => {
    const tab = tabs[selectedTab];
    // En móvil las pestañas forman dos filas: el indicador se ubica bajo la fila de la pestaña activa.
    const y = tab.offsetTop + tab.offsetHeight - tabList.clientHeight;
    if (gsap) gsap.to(indicator, { x: tab.offsetLeft, y, width: tab.offsetWidth, duration: animate && !reducedMotion.matches ? .55 : 0, ease: 'power3.out', overwrite: true });
    else { indicator.style.width = `${tab.offsetWidth}px`; indicator.style.transform = `translate(${tab.offsetLeft}px, ${y}px)`; }
  };
  const activateTab = (index, focus = false) => {
    const oldPanel = panels[selectedTab];
    selectedTab = index;
    tabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; });
    panelAnimation?.kill();
    panels.forEach((panel, i) => { panel.hidden = i !== index; panel.inert = i !== index; });
    const newPanel = panels[index];
    if (gsap && !reducedMotion.matches && newPanel !== oldPanel) {
      oldPanel.hidden = false;
      oldPanel.inert = true;
      oldPanel.setAttribute('aria-hidden', 'true');
      panelAnimation = gsap.timeline({ onComplete: () => { oldPanel.hidden = true; oldPanel.removeAttribute('aria-hidden'); gsap.set(oldPanel, { clearProps: 'opacity,transform' }); ScrollTrigger?.refresh(); } });
      panelAnimation.fromTo(oldPanel, { opacity: 1, y: 0 }, { opacity: 0, y: -8, duration: .25 }, 0).fromTo(newPanel, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .55, ease: 'power3.out', clearProps: 'opacity,transform' }, .1);
    } else if (gsap) gsap.set(newPanel, { clearProps: 'opacity,transform' });
    newPanel.removeAttribute('aria-hidden');
    placeIndicator(true);
    const left = tabs[index].offsetLeft;
    const right = left + tabs[index].offsetWidth;
    if (left < tabList.scrollLeft || right > tabList.scrollLeft + tabList.clientWidth) tabList.scrollTo({ left: Math.max(0, left - 16), behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    if (focus) tabs[index].focus({ preventScroll: true });
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateTab(index));
    tab.addEventListener('keydown', (event) => {
      let next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault(); activateTab(next, true);
    });
  });
  placeIndicator();
  new ResizeObserver(() => placeIndicator()).observe(tabList);
  // Las capturas de las otras pestañas se descargan al acercarse al panel: cambiar de pestaña no deja el marco vacío.
  new IntersectionObserver((entries, observer) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    $$('.admin-view img').forEach((img) => { img.loading = 'eager'; });
    observer.disconnect();
  }, { rootMargin: '600px 0px' }).observe($('.admin-panels'));

  // Video optativo: se carga solo si el recurso real está listo y se ve en pantalla.
  const video = $('#portada-video');
  const videoControl = $('.video-control');
  let videoVisible = false;
  let userPausedVideo = false;
  const updateVideo = () => {
    if (!config.heroVideoReady) return;
    if (videoVisible && !document.hidden && !reducedMotion.matches && !userPausedVideo) {
      if (!video.dataset.loaded) {
        $$('source[data-src]', video).forEach((source) => { source.src = source.dataset.src; });
        video.load(); video.dataset.loaded = 'true';
      }
      video.play().catch(() => { videoControl.textContent = 'Reproducir video'; videoControl.setAttribute('aria-pressed', 'true'); });
    } else video.pause();
  };
  if (config.heroVideoReady) {
    video.setAttribute('aria-label', 'Recorrido por el hall del banco del curso Guardias de Seguridad.');
    video.addEventListener('playing', () => { videoControl.hidden = false; videoControl.textContent = 'Pausar video'; videoControl.setAttribute('aria-pressed', 'false'); });
    video.addEventListener('pause', () => { videoControl.textContent = 'Reproducir video'; videoControl.setAttribute('aria-pressed', 'true'); });
    if (reducedMotion.matches) { videoControl.hidden = false; videoControl.textContent = 'Reproducir video'; }
    videoControl.addEventListener('click', () => {
      userPausedVideo = !video.paused;
      if (video.paused) {
        if (!video.dataset.loaded) { $$('source[data-src]', video).forEach((s) => { s.src = s.dataset.src; }); video.load(); video.dataset.loaded = 'true'; }
        video.play().catch(() => { videoControl.textContent = 'Video no disponible'; });
      } else video.pause();
    });
    new IntersectionObserver(([entry]) => { videoVisible = entry.isIntersecting; updateVideo(); }, { threshold: .1 }).observe(video);
    document.addEventListener('visibilitychange', updateVideo);
  }

  // Si faltara una dependencia, las funciones anteriores y todo el contenido
  // siguen operativos. La animación nunca es condición para leer la página.
  if (!gsap || !ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  const createMotion = () => gsap.context(() => {
    const cleanup = [];
    const on = (node, event, listener, options) => { node.addEventListener(event, listener, options); cleanup.push(() => node.removeEventListener(event, listener, options)); };
    gsap.defaults({ ease: 'power3.out', duration: .7 });
    // Desktop utiliza Lenis; el gesto táctil mantiene el desplazamiento nativo.
    let tick = null;
    if (window.Lenis && finePointer.matches) {
      lenis = new window.Lenis({ duration: 1.05, smoothWheel: true, syncTouch: false, autoRaf: false });
      lenis.on('scroll', ScrollTrigger.update);
      tick = (time) => lenis?.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    }
    // Portada: la escena entra de fondo y luego el título por palabras, la bajada y la tarjeta.
    const intro = gsap.timeline();
    intro.from('.hero-media', { opacity: .3, scale: 1.05, duration: 1.6, ease: 'power2.out', clearProps: 'opacity,transform' }, 0)
      .from('.hero-eyebrow', { opacity: 0, y: 8, duration: .6 }, 0)
      .from('.word', { yPercent: 112, opacity: 0, stagger: .065, duration: .85 }, .05)
      .from('.hero-description,.hero-buttons,.hero-foot', { opacity: 0, y: 16, stagger: .07 }, .4)
      .from('.float-card', { opacity: 0, y: 18, duration: .8 }, .75);
    // La tarjeta de decisión flota después de entrar y solo mientras la portada sigue a la vista.
    const floatTween = gsap.to('.float-card', { y: 5, repeat: -1, yoyo: true, duration: 3.5, ease: 'sine.inOut', paused: true });
    let heroVisible = true;
    const syncFloat = () => (heroVisible && finePointer.matches && !intro.isActive() ? floatTween.play() : floatTween.pause());
    intro.eventCallback('onComplete', syncFloat);
    ScrollTrigger.create({ trigger: '.hero', start: 'top bottom', end: 'bottom top', onToggle: (s) => { heroVisible = s.isActive; syncFloat(); } });
    // Cada elemento se revela una sola vez. Sin estilos que oculten contenido si JS falla.
    $$('.reveal').forEach((node) => gsap.from(node, { opacity: 0, y: 24, duration: .75, scrollTrigger: { trigger: node, start: 'top 91%', once: true } }));
    gsap.from('.bento-card', { opacity: 0, y: 32, stagger: .075, duration: .8, scrollTrigger: { trigger: '.bento-grid', start: 'top 85%', once: true } });
    $$('.guard-scene').forEach((node) => gsap.from(node, { opacity: 0, y: 24, duration: .75, scrollTrigger: { trigger: node, start: 'top 89%', once: true } }));
    // Progreso de 5S y pasos: solo escala y opacidad, sin alterar geometría.
    gsap.fromTo('.five-timeline', { '--line-progress': 0 }, { '--line-progress': 1, ease: 'none', scrollTrigger: { trigger: '.five-timeline', start: 'top 82%', end: 'bottom 42%', scrub: .5, onUpdate: (self) => $$('.phase').forEach((phase, index) => phase.classList.toggle('is-active', self.progress > index / 5)) } });
    $$('.how-steps li').forEach((step) => gsap.from($('.step-line i', step), { scaleX: 0, ease: 'none', scrollTrigger: { trigger: step, start: 'top 84%', end: 'bottom 62%', scrub: .6 } }));
    const sceneNames = ['Condominio', 'Supermercado', 'Banco'];
    $$('.guard-scene').forEach((scene, index) => ScrollTrigger.create({ trigger: scene, start: 'top 56%', end: 'bottom 56%', onToggle: (self) => {
      if (self.isActive) { $('.guard-current').textContent = `0${index + 1}`; $('.guard-current-name').textContent = sceneNames[index]; gsap.to('.guard-progress i', { scaleX: (index + 1) / 3, duration: .6 }); }
    } }));
    // Fundido entre tonos mediante una capa, para evitar animar el fondo completo.
    $$('.tone-transition').forEach((section) => {
      const veil = document.createElement('div'); veil.className = 'tone-veil'; veil.setAttribute('aria-hidden', 'true'); veil.style.background = section.classList.contains('dark') ? '#484B40' : '#DDDFD5'; section.prepend(veil);
      gsap.fromTo(veil, { opacity: .55 }, { opacity: 0, ease: 'none', scrollTrigger: { trigger: section, start: 'top bottom', end: 'top 30%', scrub: .7 } });
      cleanup.push(() => veil.remove());
    });
    if (finePointer.matches) {
      // Parallax mínimo en capturas y escena de portada. Nunca mueve texto.
      $$('.scene-media img').forEach((img) => gsap.fromTo(img, { scale: 1.055, yPercent: -1.5 }, { yPercent: 1.5, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: .8 } }));
      gsap.to('.hero-media video', { yPercent: 6, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .8 } });
      $$('[data-tilt]').forEach((card) => {
        const rotX = gsap.quickTo(card, 'rotationX', { duration: .65 });
        const rotY = gsap.quickTo(card, 'rotationY', { duration: .65 });
        gsap.set(card, { transformPerspective: 1000 });
        on(card, 'pointermove', (e) => { const r = card.getBoundingClientRect(); rotX(-(e.clientY - r.top - r.height / 2) / r.height * 2); rotY((e.clientX - r.left - r.width / 2) / r.width * 2); }, { passive: true });
        on(card, 'pointerleave', () => { rotX(0); rotY(0); });
      });
      $$('.magnetic').forEach((button) => {
        const x = gsap.quickTo(button, 'x', { duration: .6 }); const y = gsap.quickTo(button, 'y', { duration: .6 });
        on(button, 'pointermove', (e) => { const r = button.getBoundingClientRect(); x((e.clientX - r.left - r.width / 2) * .07); y((e.clientY - r.top - r.height / 2) * .1); }, { passive: true });
        on(button, 'pointerleave', () => { x(0); y(0); });
      });
    }
    $$('.button').forEach((button) => on(button, 'pointerenter', (e) => { const r = button.getBoundingClientRect(); button.style.setProperty('--button-origin', e.clientX < r.left + r.width / 2 ? 'left' : 'right'); }));
    document.fonts.ready.then(() => { placeIndicator(); ScrollTrigger.refresh(); });
    return () => { cleanup.forEach((fn) => fn()); if (tick) gsap.ticker.remove(tick); lenis?.destroy(); lenis = null; };
  });
  let motionContext = null;
  const applyMotionPreference = () => {
    motionContext?.revert();
    motionContext = null;
    if (!reducedMotion.matches) motionContext = createMotion();
    updateVideo();
  };
  applyMotionPreference();
  reducedMotion.addEventListener('change', applyMotionPreference);
})();
