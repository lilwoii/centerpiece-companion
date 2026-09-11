const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
app.setPath('userData', path.join(app.getPath('temp'), 'centerpiece-update-notes-verification'));
app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({ show: false, width: 1320, height: 920, webPreferences: { backgroundThrottling: false, offscreen: true, preload: path.join(__dirname, 'update-notes-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: false } });
    const errors = [], js = source => win.webContents.executeJavaScript(source), wait = () => new Promise(resolve => setTimeout(resolve, 120));
    win.webContents.on('console-message', (_event, level, message) => { if (level >= 3 && !message.includes('Content-Security-Policy')) errors.push(message); });
    await win.loadFile(path.join(__dirname, '../src/index.html'));
    await wait();
    assert.equal(await js('document.getElementById("update-notes").hidden'), false);
    assert.equal(await js('document.getElementById("update-notes-heading").textContent'), 'New update changes');
    assert.equal(await js('document.querySelectorAll("#update-notes-list li").length'), 3);
    assert.equal(await js('document.activeElement.tagName'), 'H1', 'notes must not steal startup focus');
    assert.equal(await js('document.getElementById("update-notes-close").getAttribute("aria-label")'), 'Dismiss update changes');
    const dir = path.join(__dirname, '../verification'); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'update-notes.png'), (await win.webContents.capturePage()).toPNG());
    win.setSize(560, 900); await wait();
    assert.equal(await js('document.documentElement.scrollWidth<=innerWidth'), true);
    assert.equal(await js('document.getElementById("update-notes-close").getBoundingClientRect().right<=innerWidth'), true);
    fs.writeFileSync(path.join(dir, 'update-notes-narrow.png'), (await win.webContents.capturePage()).toPNG());
    await js('window.updateNotesTest.fail(true); document.getElementById("update-notes-close").focus(); document.getElementById("update-notes-close").click()'); await wait();
    assert.equal(await js('document.getElementById("update-notes").hidden'), false);
    assert.match(await js('document.getElementById("desk-feedback").textContent'), /Could not save/);
    assert.equal(await js('document.getElementById("update-notes-close").disabled'), false);
    await js('window.updateNotesTest.fail(false); document.getElementById("update-notes-close").focus(); document.getElementById("update-notes-close").click()'); await wait();
    assert.equal(await js('document.getElementById("update-notes").hidden'), true);
    assert.equal(await js('document.activeElement.tagName'), 'H1', 'close restores focus to active page');
    await js('window.updateNotesTest.rebroadcast(); window.updateNotesTest.stale()'); await wait();
    assert.equal(await js('document.getElementById("update-notes").hidden'), true, 'background state cannot reopen dismissed notes');
    assert.deepEqual(errors, []);
    console.log('Update notes: desktop/narrow layout, focus, failed dismissal, successful dismissal and stale state passed.');
    win.destroy(); app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
