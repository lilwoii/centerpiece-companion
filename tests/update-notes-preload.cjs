// Reuse the isolated feature adapters, extending only the local update-note API.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const electron = require('electron');
const { UpdateNotes } = require('../src/update-notes.cjs');
const directory = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'centerpiece-notes-ui-'));
const notes = new UpdateNotes({ directory, version: '0.3.0-preview.19' });
const listeners = [];
let failing = false;
const bridge = {
  exposeInMainWorld(name, methods) {
    const getState = methods.getState, subscribe = methods.subscribe;
    methods.getState = async () => ({ ...await getState(), updateNotes: notes.view() });
    methods.subscribe = callback => {
      listeners.push(callback);
      return subscribe(state => callback({ ...state, updateNotes: notes.view() }));
    };
    methods.dismissUpdateNotes = async version => {
      if (failing) throw new Error('Test save failure');
      const result = notes.dismiss(version);
      const state = await methods.getState();
      for (const listener of listeners) listener(state);
      return result;
    };
    electron.contextBridge.exposeInMainWorld(name, methods);
    electron.contextBridge.exposeInMainWorld('updateNotesTest', {
      fail: value => { failing = value; },
      rebroadcast: async () => { const state = await methods.getState(); for (const listener of listeners) listener(state); },
      stale: async () => { const state = { ...await getState(), updateNotes: { version: '0.3.0-preview.19', items: ['Stale state'] } }; for (const listener of listeners) listener(state); }
    });
  }
};
const adapter = new vm.Script('(function(require, __dirname, window) {' + fs.readFileSync(path.join(__dirname, 'features-preload.cjs'), 'utf8') + '\n})', { filename: 'features-preload.cjs' }).runInThisContext();
adapter(name => name === 'electron' ? { ...electron, contextBridge: bridge } : require(name), __dirname, window);
window.addEventListener('unload', () => { for (const name of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, name)); fs.rmdirSync(directory); });
