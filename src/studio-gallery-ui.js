(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.StudioGallery = api;
    api.mount(root, document);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PAGE_SIZE = 6;
  const SAFE_ID = /^[a-z][a-z0-9-]{0,79}$/;

  function collectionEntries(collection, presets) {
    const entries = [], seen = new Set();
    const legacy = (presets?.list || []).find(item => item.id === 'ignition');
    for (const item of [...(collection?.list || []), ...(legacy ? [legacy] : [])]) {
      if (!item || !SAFE_ID.test(item.id) || seen.has(item.id) || typeof item.create !== 'function' && typeof item.createAsync !== 'function') continue;
      seen.add(item.id);
      const original = item.id === 'ignition';
      entries.push({
        id: item.id,
        name: String(item.title || item.name || item.id).slice(0,100),
        description: String(item.description || '').slice(0,500),
        interaction: String(item.interaction || (original ? 'Press Space or click the preview to launch. WASD scatters sparks.' : 'Open in Studio to try its interaction rules.')).slice(0,500),
        style: original ? 'Animated' : String(item.style || 'Animated'),
        original,
        preview: '../studio/examples/community-collection/previews/' + item.id + '.png',
        create: typeof item.create === 'function' ? item.create.bind(item) : undefined,
        createAsync: typeof item.createAsync === 'function' ? item.createAsync.bind(item) : undefined
      });
    }
    return entries.slice(0,24);
  }

  function filterEntries(entries, query = '', style = 'all') {
    const needle = String(query).trim().toLocaleLowerCase();
    return entries.filter(item => {
      const isAnimated = item.style === 'Animated';
      return (style === 'all' || style === 'animated' && isAnimated || style === 'realistic' && !isAnimated)
        && (item.name + ' ' + item.description + ' ' + item.interaction).toLocaleLowerCase().includes(needle);
    });
  }

  async function projectDownload(entry, model) {
    if (!entry || !SAFE_ID.test(entry.id) || typeof entry.create !== 'function' && typeof entry.createAsync !== 'function') throw Error('This Studio project is unavailable. Reopen the collection and try again.');
    // Full projects include their artwork. A failed load must not silently export a reduced preview.
    const project = model.validate(await (entry.createAsync ? entry.createAsync() : entry.create()));
    return { name: entry.id + '.cpskin', text: JSON.stringify(project, null, 2) };
  }

  function mount(host, doc) {
    const page = doc.querySelector('[data-page="skins"]'), heading = page?.querySelector('.page-heading');
    if (!heading || doc.getElementById('studio-collection')) return;
    const entries = collectionEntries(host.StudioCollectionPresets, host.StudioPresets);
    const make = (tag, text, className) => {
      const element = doc.createElement(tag);
      if (text !== undefined) element.textContent = text;
      if (className) element.className = className;
      return element;
    };
    const section = make('section', undefined, 'studio-collection');
    section.id = 'studio-collection';
    section.setAttribute('aria-labelledby', 'studio-collection-title');
    const top = make('div', undefined, 'studio-collection-heading');
    const title = make('h2', 'Interactive Studio collection');
    title.id = 'studio-collection-title';
    const badge = make('span', 'Interactive', 'studio-collection-category');
    top.append(title, badge);
    section.append(top, make('p', 'Explore and edit these projects in Skin Studio. Keyboard-ready .pak builds are still pending.', 'note studio-collection-note'));
    const toolbar = make('div', undefined, 'skin-toolbar studio-collection-toolbar');
    const searchLabel = make('label', 'Find a Studio project');
    const search = make('input');
    search.id = 'studio-collection-search';
    search.type = 'search';
    search.placeholder = 'Rocket, ocean, forest…';
    search.maxLength = 100;
    searchLabel.htmlFor = search.id;
    searchLabel.append(search);
    const clear = make('button', 'Clear search', 'button');
    clear.type = 'button';
    clear.id = 'studio-collection-clear';
    clear.disabled = true;
    const styleLabel = make('label', 'Visual style');
    const style = make('select');
    style.id = 'studio-collection-style';
    styleLabel.htmlFor = style.id;
    for (const [value, label] of [['all','All styles'],['animated','Animated'],['realistic','Realistic style']]) {
      const option = make('option', label);
      option.value = value;
      style.append(option);
    }
    styleLabel.append(style);
    toolbar.append(searchLabel, clear, styleLabel);
    const status = make('p', '', 'note studio-collection-status');
    status.id = 'studio-collection-status';
    status.setAttribute('role', 'status');
    const grid = make('div', undefined, 'skin-grid studio-collection-grid');
    grid.id = 'studio-collection-grid';
    const more = make('button', 'Show more Studio projects', 'button');
    more.type = 'button';
    more.id = 'studio-collection-more';
    more.setAttribute('aria-controls', grid.id);
    section.append(toolbar, status, grid, more);
    heading.after(section);
    let pageSize = PAGE_SIZE;

    const report = (message, error = false) => {
      if (typeof announce === 'function') announce(message, error);
      else { status.textContent = message; status.classList.toggle('error', error); }
    };
    const run = (button, operation) => {
      if (typeof task === 'function') return task(button, operation);
      if (button.disabled) return;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      return Promise.resolve().then(operation).catch(error => report(error.message, true)).finally(() => {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      });
    };

    function draw() {
      const visible = filterEntries(entries, search.value, style.value);
      clear.disabled = search.value.length === 0;
      grid.replaceChildren();
      status.classList.remove('error');
      status.textContent = !entries.length ? 'The Studio collection could not load. Reopen the app to try again.'
        : !visible.length ? 'No Studio projects match. Clear the search or choose another visual style.'
          : 'Showing ' + Math.min(pageSize, visible.length) + ' of ' + visible.length + ' interactive projects · Stored with this test build';
      more.hidden = visible.length <= pageSize;
      for (const entry of visible.slice(0, pageSize)) {
        const article = make('article', undefined, 'skin-card studio-project-card');
        const visual = make('div', undefined, 'studio-project-visual');
        const image = make('img');
        image.src = new URL(entry.preview, doc.baseURI).href;
        image.alt = entry.name + ' — keyboard canvas preview';
        image.width = 1920;
        image.height = 550;
        image.loading = 'lazy';
        image.decoding = 'async';
        const unavailable = make('span', 'Preview unavailable · Open in Studio to view the scene', 'studio-project-image-fallback');
        unavailable.hidden = true;
        image.addEventListener('error', () => { image.hidden = true; unavailable.hidden = false; }, { once: true });
        visual.append(image, unavailable);
        const body = make('div', undefined, 'skin-card-body');
        const meta = make('div', undefined, 'studio-project-meta');
        meta.append(make('span', 'Studio project', 'studio-project-format'), make('span', entry.original ? 'Original launch' : entry.style, 'note'));
        const name = make('h3', entry.name);
        const description = make('p', entry.description, 'studio-project-description');
        const interaction = make('p', entry.interaction, 'studio-project-interaction');
        const actions = make('div', undefined, 'studio-project-actions');
        const open = make('button', 'Open in Studio', 'button primary');
        open.type = 'button';
        open.setAttribute('aria-label', 'Open ' + entry.name + ' in Studio');
        open.addEventListener('click', () => {
          host.dispatchEvent(new CustomEvent('studio-open-preset', { detail: { id: entry.id } }));
        });
        const download = make('button', 'Download project', 'button');
        download.type = 'button';
        download.setAttribute('aria-label', 'Download ' + entry.name + ' editable project');
        download.addEventListener('click', () => run(download, async () => {
          const value = await projectDownload(entry, host.StudioModel);
          const url = URL.createObjectURL(new Blob([value.text], { type: 'application/json' }));
          const link = make('a');
          link.href = url;
          link.download = value.name;
          doc.body.append(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 30000);
          report(entry.name + ' project downloaded. Open the .cpskin file in Skin Studio; keyboard .pak export still needs a verified native build.');
        }));
        actions.append(open, download);
        body.append(meta, name, description, interaction, actions);
        article.append(visual, body);
        grid.append(article);
      }
    }
    search.addEventListener('input', () => { pageSize = PAGE_SIZE; draw(); });
    style.addEventListener('change', () => { pageSize = PAGE_SIZE; draw(); });
    clear.addEventListener('click', () => { search.value = ''; pageSize = PAGE_SIZE; draw(); search.focus(); });
    more.addEventListener('click', () => {
      const previous = grid.children.length;
      pageSize += PAGE_SIZE;
      draw();
      grid.children[previous]?.querySelector('button')?.focus({ preventScroll: true });
    });
    draw();
  }
  return { collectionEntries, filterEntries, projectDownload, mount };
});
