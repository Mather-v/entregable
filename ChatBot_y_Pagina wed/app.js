(() => {
  let apiUrl = 'https://libretranslate.com/translate';
  const LANGS = [
    { code: 'es', name: 'Español' },
    { code: 'en', name: 'Inglés' },
    { code: 'fr', name: 'Francés' },
    { code: 'de', name: 'Alemán' },
    { code: 'it', name: 'Italiano' },
    { code: 'pt', name: 'Portugués' },
    { code: 'ru', name: 'Ruso' },
    { code: 'zh', name: 'Chino' },
    { code: 'ja', name: 'Japonés' },
    { code: 'ar', name: 'Árabe' }
  ];
  const SOURCE_LANGS = [{ code: 'auto', name: 'Auto' }, ...LANGS];
  const PRESET_ENDPOINTS = [
    { name: 'LibreTranslate Público', url: 'https://libretranslate.com/translate' },
    { name: 'Localhost (5000)', url: 'http://localhost:5000/translate' }
  ];

  let isTranslating = false;
  let targetLang = 'es';
  let sourceLang = 'auto';
  let autoTranslate = true;
  let visibleOnly = false;
  let io = null;
  let throttleId = null;
  const queuedElements = new Set();
  const translatedNodes = new WeakSet();
  let mo = null;
  let requestsPerSec = 3;
  let lastRequestAt = 0;
  let requestChain = Promise.resolve();
  let minDelayMs = Math.floor(1000 / requestsPerSec);
  let theme = { bg: '#111C2D', text: '#FFFFFF', border: '#15263A', accent1: '#0A84FF', accent2: '#FF39EF', cyan: '#00FFFF', fontPrimary: '"Bebas Neue", Montserrat, sans-serif', fontSecondary: 'Montserrat, sans-serif' };
  let applySiteTheme = true;
  let siteThemeStyleEl = null;
  const brandLogoSrc = '/assets/svg/kognia-logo-hor-light.svg';

  function createSvg(type) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.style.width = '22px';
    svg.style.height = '22px';
    svg.style.fill = 'none';
    svg.style.stroke = '#fff';
    svg.style.strokeWidth = '2';
    svg.style.strokeLinecap = 'round';
    svg.style.strokeLinejoin = 'round';
    if (type === 'globe') {
      const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx','12'); c.setAttribute('cy','12'); c.setAttribute('r','10');
      const l1 = document.createElementNS(ns, 'path'); l1.setAttribute('d','M2 12h20');
      const l2 = document.createElementNS(ns, 'path'); l2.setAttribute('d','M12 2a15 15 0 0 1 0 20');
      const l3 = document.createElementNS(ns, 'path'); l3.setAttribute('d','M12 2a15 15 0 0 0 0 20');
      svg.append(c,l1,l2,l3);
    } else if (type === 'spinner') {
      const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx','12'); c.setAttribute('cy','12'); c.setAttribute('r','10'); c.style.opacity='0.3';
      const arc = document.createElementNS(ns, 'path'); arc.setAttribute('d','M12 2a10 10 0 0 1 10 10');
      svg.append(c,arc);
      svg.style.animation = 'traductor-spin 0.8s linear infinite';
    } else if (type === 'play') {
      const p = document.createElementNS(ns, 'polygon'); p.setAttribute('points','8,5 19,12 8,19');
      svg.append(p);
    }
    return svg;
  }

  function saveSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ traductorSettings: { targetLang, sourceLang, autoTranslate, visibleOnly, apiUrl, requestsPerSec, theme, applySiteTheme } });
    } else {
      try {
        localStorage.setItem('traductorSettings', JSON.stringify({ targetLang, sourceLang, autoTranslate, visibleOnly, apiUrl, requestsPerSec, theme, applySiteTheme }));
      } catch {}
    }
  }

  function loadSettings() {
    return new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get('traductorSettings', data => {
          const s = data && data.traductorSettings;
          if (s && s.targetLang) targetLang = s.targetLang;
          if (s && s.sourceLang) sourceLang = s.sourceLang;
          if (typeof s?.autoTranslate === 'boolean') autoTranslate = s.autoTranslate;
          if (typeof s?.visibleOnly === 'boolean') visibleOnly = s.visibleOnly;
          if (typeof s?.apiUrl === 'string' && s.apiUrl) apiUrl = s.apiUrl;
          if (typeof s?.requestsPerSec === 'number' && s.requestsPerSec > 0) {
            requestsPerSec = s.requestsPerSec;
            minDelayMs = Math.floor(1000 / requestsPerSec);
          }
          if (s && s.theme) theme = { ...theme, ...s.theme };
          if (typeof s?.applySiteTheme === 'boolean') applySiteTheme = s.applySiteTheme;
          resolve();
        });
      } else {
        try {
          const raw = localStorage.getItem('traductorSettings');
          if (raw) {
            const s = JSON.parse(raw);
            if (s && s.targetLang) targetLang = s.targetLang;
            if (s && s.sourceLang) sourceLang = s.sourceLang;
            if (typeof s?.autoTranslate === 'boolean') autoTranslate = s.autoTranslate;
            if (typeof s?.visibleOnly === 'boolean') visibleOnly = s.visibleOnly;
            if (typeof s?.apiUrl === 'string' && s.apiUrl) apiUrl = s.apiUrl;
            if (typeof s?.requestsPerSec === 'number' && s.requestsPerSec > 0) {
              requestsPerSec = s.requestsPerSec;
              minDelayMs = Math.floor(1000 / requestsPerSec);
            }
            if (s && s.theme) theme = { ...theme, ...s.theme };
            if (typeof s?.applySiteTheme === 'boolean') applySiteTheme = s.applySiteTheme;
          }
        } catch {}
        resolve();
      }
    });
  }

  function applyThemeToPage() {
    if (!applySiteTheme) {
      if (siteThemeStyleEl && siteThemeStyleEl.parentNode) siteThemeStyleEl.parentNode.removeChild(siteThemeStyleEl);
      siteThemeStyleEl = null;
      return;
    }
    const css = `:root{--font-primary:${theme.fontPrimary};--font-secondary:${theme.fontSecondary};--default-font-family:Montserrat, sans-serif;--kognia-cyan:${theme.cyan};--kognia-pink:${theme.accent2};--color-primary:${theme.accent1};--color-accent:${theme.accent2};--color-dark-blue:${theme.border};--color-dark-bg:${theme.bg};--color-bg:#000010}body{background-color:var(--color-bg);color:#fff;font-family:var(--default-font-family)!important}h1,h2,h3{font-family:var(--font-primary)!important}header,nav{background-color:var(--color-dark-bg)!important;border-bottom:1px solid var(--color-dark-blue)!important;border-top:2px solid var(--color-accent)!important}button,.btn,a.button{background:linear-gradient(135deg,var(--color-primary),var(--color-accent))!important;color:#fff!important;border:1px solid var(--color-dark-blue)!important}a{color:var(--kognia-cyan)!important}`;
    if (!siteThemeStyleEl) {
      siteThemeStyleEl = document.createElement('style');
      document.documentElement.appendChild(siteThemeStyleEl);
    }
    siteThemeStyleEl.textContent = css;
  }

  function updateThemeStyles() {
    const g = `linear-gradient(135deg, ${theme.accent1}, ${theme.accent2})`;
    if (floatingIcon && floatingIcon.icon) {
      floatingIcon.icon.style.background = g;
    }
    if (floatingIcon && floatingIcon.panel) {
      floatingIcon.panel.style.background = theme.bg;
      floatingIcon.panel.style.color = theme.text;
      floatingIcon.panel.style.borderColor = theme.border;
      floatingIcon.panel.style.borderTopColor = theme.accent2;
    }
    if (floatingIcon && floatingIcon.btnTranslate) {
      floatingIcon.btnTranslate.style.background = g;
      floatingIcon.btnTranslate.style.color = '#fff';
    }
    if (floatingIcon && floatingIcon.testBtn) {
      floatingIcon.testBtn.style.background = theme.accent1;
      floatingIcon.testBtn.style.color = '#fff';
    }
    if (floatingIcon && floatingIcon.showLangsBtn) {
      floatingIcon.showLangsBtn.style.background = theme.accent1;
      floatingIcon.showLangsBtn.style.color = '#fff';
    }
    applyThemeToPage();
  }

  function createFloatingIcon() {
    const icon = document.createElement('div');
    icon.id = 'traductor-floating-icon';
    icon.style.position = 'fixed';
    icon.style.bottom = '20px';
    icon.style.right = '20px';
    icon.style.width = '44px';
    icon.style.height = '44px';
    icon.style.borderRadius = '50%';
    icon.style.boxShadow = '0 8px 16px rgba(0,0,0,0.2)';
    icon.style.display = 'flex';
    icon.style.alignItems = 'center';
    icon.style.justifyContent = 'center';
    icon.style.fontFamily = theme.fontSecondary;
    icon.style.fontSize = '12px';
    icon.style.background = `linear-gradient(135deg, ${theme.accent1}, ${theme.accent2})`;
    icon.style.color = '#fff';
    icon.style.zIndex = '2147483647';
    icon.style.cursor = 'pointer';
    icon.style.userSelect = 'none';
    icon.title = 'Traductor';

    const spinner = createSvg('spinner');
    const idleIcon = createSvg('globe');
    idleIcon.style.display = 'none';

    const label = document.createElement('span');
    label.textContent = targetLang.toUpperCase();
    label.style.display = 'none';
    label.style.fontFamily = theme.fontPrimary;

    icon.appendChild(spinner);
    icon.appendChild(idleIcon);
    icon.appendChild(label);

    const style = document.createElement('style');
    style.textContent = `@keyframes traductor-spin {from {transform: rotate(0)} to {transform: rotate(360deg)}}`;
    document.head.appendChild(style);

    const panel = document.createElement('div');
    panel.style.position = 'fixed';
    panel.style.bottom = '72px';
    panel.style.right = '20px';
    panel.style.minWidth = '220px';
    panel.style.background = theme.bg;
    panel.style.color = theme.text;
    panel.style.border = `1px solid ${theme.border}`;
    panel.style.borderTop = `2px solid ${theme.accent2}`;
    panel.style.boxShadow = '0 8px 16px rgba(0,0,0,0.3)';
    panel.style.borderRadius = '10px';
    panel.style.padding = '10px';
    panel.style.fontFamily = theme.fontSecondary;
    panel.style.fontSize = '13px';
    panel.style.zIndex = '2147483647';
    panel.style.display = 'none';

    const row1 = document.createElement('div');
    row1.style.display = 'flex';
    row1.style.gap = '8px';
    row1.style.alignItems = 'center';
    const sourceSel = document.createElement('select');
    sourceSel.style.flex = '1';
    sourceSel.style.background = theme.bg;
    sourceSel.style.color = theme.text;
    sourceSel.style.border = `1px solid ${theme.border}`;
    sourceSel.style.borderRadius = '6px';
    sourceSel.style.padding = '6px';
    sourceSel.style.fontFamily = theme.fontSecondary;
    for (const l of SOURCE_LANGS) {
      const opt = document.createElement('option');
      opt.value = l.code;
      opt.textContent = `Origen: ${l.name}`;
      if (l.code === sourceLang) opt.selected = true;
      sourceSel.appendChild(opt);
    }
    const langSel = document.createElement('select');
    langSel.style.flex = '1';
    langSel.style.background = theme.bg;
    langSel.style.color = theme.text;
    langSel.style.border = `1px solid ${theme.border}`;
    langSel.style.borderRadius = '6px';
    langSel.style.padding = '6px';
    langSel.style.fontFamily = theme.fontSecondary;
    for (const l of LANGS) {
      const opt = document.createElement('option');
      opt.value = l.code;
      opt.textContent = `Destino: ${l.name} (${l.code.toUpperCase()})`;
      if (l.code === targetLang) opt.selected = true;
      langSel.appendChild(opt);
    }

    const autoRow = document.createElement('label');
    autoRow.style.display = 'flex';
    autoRow.style.alignItems = 'center';
    autoRow.style.gap = '8px';
    autoRow.style.marginTop = '8px';
    const autoChk = document.createElement('input');
    autoChk.type = 'checkbox';
    autoChk.checked = autoTranslate;
    const autoTxt = document.createElement('span');
    autoTxt.textContent = 'Auto traducir';
    const visibleRow = document.createElement('label');
    visibleRow.style.display = 'flex';
    visibleRow.style.alignItems = 'center';
    visibleRow.style.gap = '8px';
    visibleRow.style.marginTop = '8px';
    const visibleChk = document.createElement('input');
    visibleChk.type = 'checkbox';
    visibleChk.checked = visibleOnly;
    const visibleTxt = document.createElement('span');
    visibleTxt.textContent = 'Solo contenido visible';
    visibleRow.appendChild(visibleChk);
    visibleRow.appendChild(visibleTxt);
    autoRow.appendChild(autoChk);
    autoRow.appendChild(autoTxt);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '8px';
    actions.style.marginTop = '10px';
    const serverRow = document.createElement('div');
    serverRow.style.display = 'flex';
    serverRow.style.gap = '8px';
    serverRow.style.marginTop = '8px';
    const endpointSel = document.createElement('select');
    endpointSel.style.background = theme.bg;
    endpointSel.style.color = theme.text;
    endpointSel.style.border = `1px solid ${theme.border}`;
    endpointSel.style.borderRadius = '6px';
    endpointSel.style.padding = '6px';
    endpointSel.style.fontFamily = theme.fontSecondary;
    for (const p of PRESET_ENDPOINTS) {
      const opt = document.createElement('option');
      opt.value = p.url;
      opt.textContent = p.name;
      if (apiUrl === p.url) opt.selected = true;
      endpointSel.appendChild(opt);
    }
    const endpointInput = document.createElement('input');
    endpointInput.type = 'text';
    endpointInput.placeholder = 'Endpoint (p.ej. https://libretranslate.com/translate)';
    endpointInput.style.flex = '2';
    endpointInput.style.background = theme.bg;
    endpointInput.style.color = theme.text;
    endpointInput.style.border = `1px solid ${theme.border}`;
    endpointInput.style.borderRadius = '6px';
    endpointInput.style.padding = '6px';
    endpointInput.style.fontFamily = theme.fontSecondary;
    endpointInput.value = apiUrl;
    const rateInput = document.createElement('input');
    rateInput.type = 'number';
    rateInput.min = '1';
    rateInput.max = '10';
    rateInput.step = '1';
    rateInput.style.width = '80px';
    rateInput.style.background = theme.bg;
    rateInput.style.color = theme.text;
    rateInput.style.border = `1px solid ${theme.border}`;
    rateInput.style.borderRadius = '6px';
    rateInput.style.padding = '6px';
    rateInput.value = String(requestsPerSec);
    rateInput.style.fontFamily = theme.fontSecondary;
    const testBtn = document.createElement('button');
    testBtn.textContent = 'Probar endpoint';
    testBtn.style.background = theme.accent1;
    testBtn.style.color = '#fff';
    testBtn.style.border = 'none';
    testBtn.style.borderRadius = '6px';
    testBtn.style.padding = '8px 10px';
    testBtn.style.cursor = 'pointer';
    testBtn.style.fontFamily = theme.fontSecondary;
    const statusMsg = document.createElement('div');
    statusMsg.style.marginTop = '6px';
    statusMsg.style.fontSize = '12px';
    statusMsg.style.color = theme.text;
    statusMsg.style.fontFamily = theme.fontSecondary;
    const langsRow = document.createElement('div');
    langsRow.style.display = 'flex';
    langsRow.style.gap = '8px';
    langsRow.style.marginTop = '8px';
    const showLangsBtn = document.createElement('button');
    showLangsBtn.textContent = 'Ver idiomas instalados';
    showLangsBtn.style.background = theme.accent1;
    showLangsBtn.style.color = '#fff';
    showLangsBtn.style.border = 'none';
    showLangsBtn.style.borderRadius = '6px';
    showLangsBtn.style.padding = '8px 10px';
    showLangsBtn.style.cursor = 'pointer';
    showLangsBtn.style.fontFamily = theme.fontSecondary;
    const langsList = document.createElement('div');
    langsList.style.marginTop = '6px';
    langsList.style.fontSize = '12px';
    langsList.style.color = theme.text;
    langsList.style.fontFamily = theme.fontSecondary;
    const themeRow = document.createElement('div');
    themeRow.style.display = 'flex';
    themeRow.style.gap = '8px';
    themeRow.style.marginTop = '8px';
    const color1 = document.createElement('input');
    color1.type = 'color';
    color1.value = theme.accent1;
    const color2 = document.createElement('input');
    color2.type = 'color';
    color2.value = theme.accent2;
    const bgColor = document.createElement('input');
    bgColor.type = 'color';
    bgColor.value = theme.bg;
    const applyThemeLabel = document.createElement('label');
    applyThemeLabel.style.display = 'flex';
    applyThemeLabel.style.alignItems = 'center';
    applyThemeLabel.style.gap = '8px';
    const applyThemeChk = document.createElement('input');
    applyThemeChk.type = 'checkbox';
    applyThemeChk.checked = applySiteTheme;
    const applyThemeTxt = document.createElement('span');
    applyThemeTxt.textContent = 'Aplicar tema a la página';
    applyThemeLabel.appendChild(applyThemeChk);
    applyThemeLabel.appendChild(applyThemeTxt);
    themeRow.appendChild(color1);
    themeRow.appendChild(color2);
    themeRow.appendChild(bgColor);
    themeRow.appendChild(applyThemeLabel);
    const hotkeysInfo = document.createElement('div');
    hotkeysInfo.style.marginTop = '8px';
    hotkeysInfo.style.fontSize = '12px';
    hotkeysInfo.style.color = '#8b949e';
    hotkeysInfo.textContent = 'Atajos: Ctrl+Shift+P panel, T traducir, V visible, A auto';
    hotkeysInfo.style.fontFamily = theme.fontSecondary;

    const btnTranslate = document.createElement('button');
    btnTranslate.textContent = 'Traducir ahora';
    btnTranslate.style.flex = '1';
    btnTranslate.style.background = `linear-gradient(135deg, ${theme.accent1}, ${theme.accent2})`;
    btnTranslate.style.color = '#fff';
    btnTranslate.style.border = 'none';
    btnTranslate.style.borderRadius = '6px';
    btnTranslate.style.padding = '8px 10px';
    btnTranslate.style.cursor = 'pointer';
    btnTranslate.style.fontFamily = theme.fontSecondary;
    const btnClose = document.createElement('button');
    btnClose.textContent = 'Cerrar';
    btnClose.style.background = '#6e7681';
    btnClose.style.color = '#fff';
    btnClose.style.border = 'none';
    btnClose.style.borderRadius = '6px';
    btnClose.style.padding = '8px 10px';
    btnClose.style.cursor = 'pointer';
    btnClose.style.fontFamily = theme.fontSecondary;

    row1.appendChild(sourceSel);
    row1.appendChild(langSel);
    actions.appendChild(btnTranslate);
    actions.appendChild(btnClose);
    panel.appendChild(header);
    panel.appendChild(row1);
    panel.appendChild(autoRow);
    panel.appendChild(visibleRow);
    serverRow.appendChild(endpointSel);
    serverRow.appendChild(endpointInput);
    serverRow.appendChild(rateInput);
    serverRow.appendChild(testBtn);
    panel.appendChild(serverRow);
    panel.appendChild(statusMsg);
    langsRow.appendChild(showLangsBtn);
    panel.appendChild(langsRow);
    panel.appendChild(langsList);
    panel.appendChild(themeRow);
    panel.appendChild(hotkeysInfo);
    panel.appendChild(actions);

    icon.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
    btnClose.addEventListener('click', () => {
      panel.style.display = 'none';
    });
    sourceSel.addEventListener('change', () => {
      sourceLang = sourceSel.value;
      saveSettings();
    });
    langSel.addEventListener('change', () => {
      targetLang = langSel.value;
      label.textContent = targetLang.toUpperCase();
      saveSettings();
    });
    autoChk.addEventListener('change', () => {
      autoTranslate = autoChk.checked;
      saveSettings();
    });
    visibleChk.addEventListener('change', () => {
      visibleOnly = visibleChk.checked;
      saveSettings();
      if (visibleOnly) {
        ensureObserver();
      } else {
        disableObservers();
      }
    });
    endpointSel.addEventListener('change', () => {
      apiUrl = endpointSel.value;
      endpointInput.value = apiUrl;
      saveSettings();
    });
    endpointInput.addEventListener('change', () => {
      const v = endpointInput.value.trim();
      if (v) {
        apiUrl = v;
        // si coincide con alguno de los presets, sincroniza el selector
        const found = PRESET_ENDPOINTS.find(p => p.url === apiUrl);
        if (found) endpointSel.value = found.url;
        saveSettings();
      }
    });
    rateInput.addEventListener('change', () => {
      let v = parseInt(rateInput.value, 10);
      if (!Number.isFinite(v) || v < 1) v = 1;
      if (v > 10) v = 10;
      requestsPerSec = v;
      minDelayMs = Math.floor(1000 / requestsPerSec);
      saveSettings();
    });
    testBtn.addEventListener('click', async () => {
      statusMsg.textContent = 'Probando…';
      statusMsg.style.color = '#e3b341';
      let ok = false;
      try {
        const base = apiUrl.replace(/\/?translate\/?$/i, '');
        const res1 = await fetch(base + '/languages', { method: 'GET' });
        if (res1.ok) {
          const js = await res1.json().catch(() => null);
          ok = Array.isArray(js);
        }
        if (!ok) {
          const res2 = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: 'test', source: 'en', target: 'es', format: 'text' })
          });
          ok = res2.ok;
        }
      } catch (e) {
        ok = false;
      }
      if (ok) {
        statusMsg.textContent = 'Conexión correcta';
        statusMsg.style.color = '#3fb950';
      } else {
        const hint = apiUrl.includes('localhost') ? '¿Servidor iniciado?' : 'Prueba localhost:5000/translate';
        statusMsg.textContent = 'Error de conexión o CORS. ' + hint;
        statusMsg.style.color = '#f85149';
      }
    });
    showLangsBtn.addEventListener('click', async () => {
      langsList.textContent = 'Cargando idiomas…';
      try {
        const base = apiUrl.replace(/\/?translate\/?$/i, '');
        const res = await fetch(base + '/languages', { method: 'GET' });
        if (!res.ok) throw new Error('err');
        const list = await res.json();
        if (Array.isArray(list) && list.length) {
          const names = list.map(x => (x.name ? x.name + ' (' + x.code + ')' : x.code)).join(', ');
          langsList.textContent = names;
          const pairTest = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: 'test', source: sourceLang === 'auto' ? 'en' : sourceLang, target: targetLang, format: 'text' })
          });
          if (!pairTest.ok) {
            langsList.textContent += ' · Falta modelo para ' + (sourceLang === 'auto' ? 'en' : sourceLang) + '→' + targetLang;
          }
        } else {
          langsList.textContent = 'Sin datos de idiomas.';
        }
      } catch (e) {
        langsList.textContent = 'Error al obtener idiomas.';
      }
    });
    window.addEventListener('offline', () => {
      statusMsg.textContent = 'Sin conexión. Usa localhost para modo offline.';
      statusMsg.style.color = '#e3b341';
    });
    window.addEventListener('online', () => {
      statusMsg.textContent = '';
    });
    btnTranslate.addEventListener('click', () => {
      panel.style.display = 'none';
      if (!isTranslating) translatePage();
    });
    color1.addEventListener('input', () => { theme.accent1 = color1.value; updateThemeStyles(); saveSettings(); });
    color2.addEventListener('input', () => { theme.accent2 = color2.value; updateThemeStyles(); saveSettings(); });
    bgColor.addEventListener('input', () => { theme.bg = bgColor.value; updateThemeStyles(); saveSettings(); });
    applyThemeChk.addEventListener('change', () => { applySiteTheme = applyThemeChk.checked; applyThemeToPage(); saveSettings(); });

    document.body.appendChild(icon);
    document.body.appendChild(panel);
    updateThemeStyles();
    return { icon, spinner, label, panel, idleIcon, btnTranslate, testBtn, showLangsBtn };
  }

  function getTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const text = node.nodeValue || '';
        if (!text.trim()) return NodeFilter.FILTER_REJECT;
        if (translatedNodes.has(node)) return NodeFilter.FILTER_REJECT;
        if (node.parentElement) {
          const tag = node.parentElement.tagName;
          if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          const cs = getComputedStyle(node.parentElement);
          const hidden = cs.display === 'none' || cs.visibility === 'hidden';
          if (hidden) return NodeFilter.FILTER_REJECT;
          if (visibleOnly) {
            const r = node.parentElement.getBoundingClientRect();
            const inView = r.bottom >= 0 && r.top <= window.innerHeight && r.right >= 0 && r.left <= window.innerWidth;
            if (!inView) return NodeFilter.FILTER_REJECT;
          }
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  function schedule(fn) {
    const run = async () => {
      const now = Date.now();
      const wait = Math.max(0, minDelayMs - (now - lastRequestAt));
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      const result = await fn();
      lastRequestAt = Date.now();
      return result;
    };
    requestChain = requestChain.then(run, run);
    return requestChain;
  }

  async function translateText(text, sourceLangParam = sourceLang) {
    return schedule(async () => {
      let attempt = 0;
      let delayMs = 400;
      for (;;) {
        try {
          const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: text, source: sourceLangParam, target: targetLang, format: 'text' })
          });
          if (res.ok) {
            const data = await res.json();
            return data.translatedText || text;
          }
          if (res.status === 429 || res.status >= 500) throw new Error('retry');
          const data = await res.json().catch(() => null);
          return (data && data.translatedText) || text;
        } catch (e) {
          attempt++;
          if (attempt >= 3) return text;
          await new Promise(r => setTimeout(r, delayMs));
          delayMs = Math.min(delayMs * 2, 4000);
        }
      }
    });
  }

  function chunkTextNodes(nodes, maxChars = 5000) {
    const batches = [];
    let current = [];
    let count = 0;
    for (const n of nodes) {
      const t = (n.nodeValue || '').trim();
      if (!t) continue;
      if (count + t.length > maxChars && current.length) {
        batches.push(current);
        current = [];
        count = 0;
      }
      current.push(n);
      count += t.length;
    }
    if (current.length) batches.push(current);
    return batches;
  }

  async function translateBatch(nodes) {
    const sep = '\u0001';
    const original = nodes.map(n => (n.nodeValue || '').trim());
    const joined = original.join(sep);
    const translatedJoined = await translateText(joined);
    const parts = translatedJoined.split(sep);
    for (let i = 0; i < nodes.length; i++) {
      const t = parts[i] || original[i];
      nodes[i].nodeValue = t;
      translatedNodes.add(nodes[i]);
    }
  }

  async function translatePage() {
    const { icon, spinner, label, idleIcon } = floatingIcon;
    isTranslating = true;
    spinner.style.display = 'block';
    idleIcon.style.display = 'none';
    label.style.display = 'none';
    icon.title = 'Traduciendo…';
    try {
      if (visibleOnly) {
        const nodes = getTextNodes(document.body);
        const batches = chunkTextNodes(nodes);
        for (const batch of batches) {
          await translateBatch(batch);
        }
        ensureObserver();
      } else {
        const nodes = getTextNodes(document.body);
        const batches = chunkTextNodes(nodes);
        for (const batch of batches) {
          await translateBatch(batch);
        }
      }
    } catch (e) {
      console.warn('Fallo al traducir:', e);
    } finally {
      isTranslating = false;
      spinner.style.display = 'none';
      idleIcon.style.display = 'block';
      label.style.display = 'block';
      label.textContent = targetLang.toUpperCase();
      icon.title = 'Traducción completa';
    }
  }

  function ensureObserver() {
    if (io) return;
    io = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          queuedElements.add(entry.target);
        }
      }
      if (!throttleId) {
        throttleId = setTimeout(processQueue, 200);
      }
    }, { root: null, threshold: 0 });
    const all = document.body.querySelectorAll('*');
    for (const el of all) io.observe(el);
    ensureMutationObserver();
  }

  function processQueue() {
    throttleId = null;
    if (queuedElements.size === 0) return;
    const { spinner, idleIcon, label, icon } = floatingIcon;
    isTranslating = true;
    spinner.style.display = 'block';
    idleIcon.style.display = 'none';
    label.style.display = 'none';
    icon.title = 'Traduciendo…';
    const elements = Array.from(queuedElements);
    queuedElements.clear();
    const nodes = [];
    for (const el of elements) {
      const ns = getTextNodes(el);
      for (const n of ns) nodes.push(n);
    }
    const batches = chunkTextNodes(nodes);
    const run = async () => {
      try {
        for (const batch of batches) {
          await translateBatch(batch);
        }
      } finally {
        isTranslating = false;
        spinner.style.display = 'none';
        idleIcon.style.display = 'block';
        label.style.display = 'block';
        label.textContent = targetLang.toUpperCase();
        icon.title = 'Traducción completa';
      }
    };
    run();
  }

  function ensureMutationObserver() {
    if (mo) return;
    mo = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.type === 'childList') {
          m.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              io && io.observe(node);
              const descendants = node.querySelectorAll ? node.querySelectorAll('*') : [];
              for (const d of descendants) io && io.observe(d);
            }
          });
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  function disableObservers() {
    if (io) {
      io.disconnect();
      io = null;
    }
    if (mo) {
      mo.disconnect();
      mo = null;
    }
    queuedElements.clear();
  }

  let floatingIcon;
  loadSettings().then(() => {
    floatingIcon = createFloatingIcon();
    if (autoTranslate) translatePage();
  });

  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey && e.shiftKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'p') {
      const panel = floatingIcon.panel;
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      e.preventDefault();
    } else if (k === 't') {
      if (!isTranslating) translatePage();
      e.preventDefault();
    } else if (k === 'v') {
      visibleOnly = !visibleOnly;
      const inputs = floatingIcon.panel.querySelectorAll('label input');
      inputs.forEach(inp => { if (inp.type==='checkbox' && inp.nextSibling && inp.nextSibling.textContent==='Solo contenido visible') inp.checked = visibleOnly; });
      saveSettings();
      if (visibleOnly) ensureObserver(); else disableObservers();
      e.preventDefault();
    } else if (k === 'a') {
      autoTranslate = !autoTranslate;
      const inputs = floatingIcon.panel.querySelectorAll('label input');
      inputs.forEach(inp => { if (inp.type==='checkbox' && inp.nextSibling && inp.nextSibling.textContent==='Auto traducir') inp.checked = autoTranslate; });
      saveSettings();
      e.preventDefault();
    }
  });
})();
    const themeRow = document.createElement('div');
    themeRow.style.display = 'flex';
    themeRow.style.gap = '8px';
    themeRow.style.marginTop = '8px';
    const color1 = document.createElement('input');
    color1.type = 'color';
    color1.value = theme.accent1;
    const color2 = document.createElement('input');
    color2.type = 'color';
    color2.value = theme.accent2;
    const bgColor = document.createElement('input');
    bgColor.type = 'color';
    bgColor.value = theme.bg;
    themeRow.appendChild(color1);
    themeRow.appendChild(color2);
    themeRow.appendChild(bgColor);
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.gap = '8px';
    header.style.fontFamily = theme.fontPrimary;
    header.style.fontSize = '18px';
    header.style.color = theme.text;
    header.style.marginBottom = '8px';
    const logoImg = document.createElement('img');
    logoImg.src = brandLogoSrc;
    logoImg.alt = 'Kognia Systems';
    logoImg.width = 180;
    logoImg.style.maxWidth = '180px';
    logoImg.style.height = 'auto';
    logoImg.style.display = 'inline-block';
    const headerTitle = document.createElement('span');
    headerTitle.textContent = 'Traductor';
    header.appendChild(logoImg);
    header.appendChild(headerTitle);
