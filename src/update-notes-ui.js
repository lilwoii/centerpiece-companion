(() => {
  const panel = document.getElementById('update-notes');
  const close = document.getElementById('update-notes-close');
  const list = document.getElementById('update-notes-list');
  let current = null, signature = '', dismissedVersion = '', closing = false, closeHadFocus = false;

  function render(state) {
    const notes = state.updateNotes;
    if (!notes || notes.version === dismissedVersion) {
      const restoreFocus = panel.contains(document.activeElement) || (closing && closeHadFocus && document.activeElement === document.body);
      panel.hidden = true;
      current = null;
      if (restoreFocus) document.querySelector('[data-page]:not([hidden]) h1')?.focus({ preventScroll: true });
      return;
    }
    const nextSignature = JSON.stringify(notes);
    current = notes;
    if (nextSignature !== signature) {
      signature = nextSignature;
      document.getElementById('update-notes-version').textContent = `Version ${notes.version}`;
      list.replaceChildren(...notes.items.map(text => {
        const item = document.createElement('li');
        item.textContent = text;
        return item;
      }));
    }
    panel.hidden = false;
    close.disabled = closing;
  }

  close.addEventListener('click', async () => {
    if (closing || !current) return;
    const version = current.version;
    closeHadFocus = panel.contains(document.activeElement);
    closing = true;
    close.disabled = true;
    close.setAttribute('aria-busy', 'true');
    try {
      await window.companion.dismissUpdateNotes(version);
      dismissedVersion = version;
      render({ updateNotes: null });
    } catch {
      announce('Could not save your update-note preference on this PC. Try closing this box again.', true);
    } finally {
      closing = false;
      close.disabled = false;
      close.removeAttribute('aria-busy');
      if (!panel.hidden && closeHadFocus && document.activeElement === document.body) close.focus({ preventScroll: true });
      closeHadFocus = false;
    }
  });

  window.companion.subscribe(render);
  window.companion.getState().then(render).catch(() => {});
})();
