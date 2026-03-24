(() => {
  const desktop = document.getElementById('desktop');
  const windowLayer = document.getElementById('windowLayer');
  const template = document.getElementById('windowTemplate');
  const menuTime = document.getElementById('menuTime');
  const batteryStatus = document.getElementById('batteryStatus');

  const appButtons = document.querySelectorAll('[data-app]');
  const STORAGE_NOTES_KEY = 'pocketdev_notes_v1';

  let zCounter = 30;
  let winCounter = 0;

  const appRegistry = {
    browser: { title: 'Browser', build: buildBrowserApp },
    notes: { title: 'Notes', build: buildNotesApp },
    devhub: { title: 'Dev Hub', build: buildDevHubApp },
    terminal: { title: 'Terminal', build: buildTerminalApp },
  };

  const shortcuts = [
    { label: 'GitHub', url: 'https://github.com' },
    { label: 'Supabase', url: 'https://supabase.com' },
    { label: 'ChatGPT', url: 'https://chat.openai.com' },
  ];

  const devhubLinks = [
    { label: 'GitHub', icon: '🐙', url: 'https://github.com' },
    { label: 'Supabase', icon: '⚡', url: 'https://supabase.com' },
    { label: 'Gmail', icon: '✉️', url: 'https://mail.google.com' },
    { label: 'Notion', icon: '📘', url: 'https://www.notion.so' },
  ];

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function updateClock() {
    const now = new Date();
    menuTime.textContent = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async function initBattery() {
    if (!navigator.getBattery) {
      batteryStatus.textContent = 'Battery --';
      return;
    }
    try {
      const battery = await navigator.getBattery();
      const syncBattery = () => {
        const pct = Math.round((battery.level || 0) * 100);
        const sign = battery.charging ? '⚡' : '';
        batteryStatus.textContent = `${sign}${pct}%`;
      };
      syncBattery();
      battery.addEventListener('chargingchange', syncBattery);
      battery.addEventListener('levelchange', syncBattery);
    } catch {
      batteryStatus.textContent = 'Battery --';
    }
  }

  function normalizeURL(input) {
    const raw = input.trim();
    if (!raw) return 'about:blank';
    if (/^https?:\/\//i.test(raw)) return raw;
    return `https://${raw}`;
  }

  function setDockActive(appName, active) {
    document.querySelectorAll(`.dock-item[data-app="${appName}"]`).forEach((el) => {
      el.classList.toggle('active', active);
    });
  }

  function bringToFront(windowEl) {
    zCounter += 1;
    windowEl.style.zIndex = zCounter;
    document.querySelectorAll('.window').forEach((win) => {
      win.classList.toggle('focused', win === windowEl);
    });
  }

  function getWindowBounds(windowEl) {
    const rect = desktop.getBoundingClientRect();
    const menuOffset = 56;
    const dockOffset = 106;
    const wRect = windowEl.getBoundingClientRect();
    return {
      minX: 0,
      minY: menuOffset,
      maxX: rect.width - wRect.width,
      maxY: rect.height - dockOffset,
    };
  }

  function makeWindowDraggable(windowEl, handleEl) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    handleEl.addEventListener('pointerdown', (event) => {
      if (event.target.closest('.window-controls')) return;
      dragging = true;
      bringToFront(windowEl);
      startX = event.clientX;
      startY = event.clientY;
      initialLeft = parseFloat(windowEl.style.left) || 0;
      initialTop = parseFloat(windowEl.style.top) || 0;
      handleEl.setPointerCapture(event.pointerId);
    });

    handleEl.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      const bounds = getWindowBounds(windowEl);
      const nextLeft = clamp(initialLeft + dx, bounds.minX, Math.max(bounds.minX, bounds.maxX));
      const nextTop = clamp(initialTop + dy, bounds.minY, Math.max(bounds.minY, bounds.maxY));
      windowEl.style.left = `${nextLeft}px`;
      windowEl.style.top = `${nextTop}px`;
    });

    const stopDrag = (event) => {
      if (!dragging) return;
      dragging = false;
      if (event.pointerId !== undefined && handleEl.hasPointerCapture(event.pointerId)) {
        handleEl.releasePointerCapture(event.pointerId);
      }
    };

    handleEl.addEventListener('pointerup', stopDrag);
    handleEl.addEventListener('pointercancel', stopDrag);
  }

  function createWindow(appName, options = {}) {
    const app = appRegistry[appName];
    if (!app) return;

    const node = template.content.firstElementChild.cloneNode(true);
    const id = `win_${Date.now()}_${winCounter++}`;
    node.dataset.app = appName;
    node.dataset.id = id;

    const titleEl = node.querySelector('.window-title');
    const titlebar = node.querySelector('.window-titlebar');
    const body = node.querySelector('.window-body');

    titleEl.textContent = app.title;

    windowLayer.appendChild(node);

    const rect = desktop.getBoundingClientRect();
    const x = clamp(24 + winCounter * 14, 6, Math.max(6, rect.width - node.offsetWidth - 6));
    const y = clamp(68 + winCounter * 16, 56, Math.max(56, rect.height - node.offsetHeight - 108));

    node.style.left = `${x}px`;
    node.style.top = `${y}px`;

    app.build(body, options, node);

    makeWindowDraggable(node, titlebar);
    bringToFront(node);
    setDockActive(appName, true);

    node.addEventListener('pointerdown', () => bringToFront(node));

    node.querySelector('[data-action="close"]').addEventListener('click', () => {
      node.classList.add('minimized');
      setTimeout(() => {
        node.remove();
        if (!document.querySelector(`.window[data-app="${appName}"]`)) {
          setDockActive(appName, false);
        }
      }, 165);
    });

    node.querySelector('[data-action="minimize"]').addEventListener('click', () => {
      node.classList.add('minimized');
      setTimeout(() => node.remove(), 165);
      if (!document.querySelector(`.window[data-app="${appName}"]`)) {
        setDockActive(appName, false);
      }
    });

    node.querySelector('[data-action="focus"]').addEventListener('click', () => {
      bringToFront(node);
      node.style.left = '4vw';
      node.style.top = '9vh';
    });

    return node;
  }

  function openApp(appName, options = {}) {
    if (appName === 'browser' && options.url) {
      createWindow('browser', options);
      return;
    }

    const existing = windowLayer.querySelector(`.window[data-app="${appName}"]`);
    if (existing) {
      bringToFront(existing);
      return;
    }
    createWindow(appName, options);
  }

  function buildBrowserApp(host, options) {
    const shell = document.createElement('div');
    shell.className = 'app-browser browser-shell';

    const toolbar = document.createElement('div');
    toolbar.className = 'browser-toolbar';

    const form = document.createElement('form');
    form.className = 'url-form';

    const input = document.createElement('input');
    input.className = 'url-input';
    input.type = 'url';
    input.inputMode = 'url';
    input.placeholder = 'Enter URL';

    const goButton = document.createElement('button');
    goButton.className = 'url-go';
    goButton.type = 'submit';
    goButton.textContent = 'Go';

    form.append(input, goButton);
    toolbar.append(form);

    const shortcutsBar = document.createElement('div');
    shortcutsBar.className = 'browser-shortcuts';

    const frame = document.createElement('iframe');
    frame.className = 'browser-frame';
    frame.loading = 'eager';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';

    const openURL = (value) => {
      const url = normalizeURL(value);
      input.value = url;
      frame.src = url;
    };

    shortcuts.forEach((item) => {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.type = 'button';
      chip.textContent = item.label;
      chip.addEventListener('click', () => openURL(item.url));
      shortcutsBar.append(chip);
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      openURL(input.value);
    });

    shell.append(toolbar, shortcutsBar, frame);
    host.append(shell);

    openURL(options.url || 'https://github.com');
  }

  function buildNotesApp(host) {
    const shell = document.createElement('div');
    shell.className = 'app-notes notes-shell';

    const meta = document.createElement('div');
    meta.className = 'notes-meta';
    meta.textContent = 'Auto-saved locally on this device';

    const area = document.createElement('textarea');
    area.className = 'notes-area';
    area.placeholder = 'Write your dev notes, commands, and ideas here...';
    area.value = localStorage.getItem(STORAGE_NOTES_KEY) || '';

    let timer;
    area.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        localStorage.setItem(STORAGE_NOTES_KEY, area.value);
      }, 120);
    });

    shell.append(meta, area);
    host.append(shell);
    requestAnimationFrame(() => area.focus());
  }

  function buildDevHubApp(host) {
    const shell = document.createElement('div');
    shell.className = 'app-devhub devhub-grid';

    devhubLinks.forEach((item) => {
      const card = document.createElement('button');
      card.className = 'devhub-card';
      card.type = 'button';
      card.innerHTML = `<strong>${item.icon}</strong><span>${item.label}</span>`;
      card.addEventListener('click', () => openApp('browser', { url: item.url }));
      shell.append(card);
    });

    host.append(shell);
  }

  function buildTerminalApp(host) {
    const shell = document.createElement('div');
    shell.className = 'app-terminal terminal-shell';

    const output = document.createElement('pre');
    output.className = 'term-output';

    const form = document.createElement('form');
    form.className = 'term-form';

    const prompt = document.createElement('span');
    prompt.className = 'term-prompt';
    prompt.textContent = 'dev@pocket:~$';

    const input = document.createElement('input');
    input.className = 'term-input';
    input.type = 'text';
    input.autocomplete = 'off';
    input.autocapitalize = 'off';
    input.spellcheck = false;

    form.append(prompt, input);

    const appendLine = (text, className = '') => {
      const line = document.createElement('div');
      if (className) line.className = className;
      line.textContent = text;
      output.append(line);
      output.scrollTop = output.scrollHeight;
    };

    const runCommand = (raw) => {
      const command = raw.trim();
      if (!command) return;
      appendLine(`dev@pocket:~$ ${command}`, 'term-line');

      const [cmd, ...args] = command.split(' ');
      switch (cmd.toLowerCase()) {
        case 'help':
          appendLine('Available: help, clear, date, echo <text>');
          break;
        case 'clear':
          output.innerHTML = '';
          break;
        case 'date':
          appendLine(new Date().toString());
          break;
        case 'echo':
          appendLine(args.join(' '));
          break;
        default:
          appendLine(`Command not found: ${cmd}`);
      }
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = input.value;
      runCommand(value);
      input.value = '';
    });

    shell.append(output, form);
    host.append(shell);

    appendLine('PocketDev Terminal ready. Type "help".');
    requestAnimationFrame(() => input.focus());
  }

  appButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const appName = button.dataset.app;
      openApp(appName);
    });
  });

  updateClock();
  setInterval(updateClock, 1000);
  initBattery();

  openApp('devhub');
})();
