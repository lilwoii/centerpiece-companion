const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const releaseNotes = require('./update-notes-data.cjs');

class UpdateNotes {
  constructor({ directory, version, notes = releaseNotes, io = fs }) {
    this.directory = directory;
    this.version = version;
    this.io = io;
    this.file = path.join(directory, 'update-notes.json');
    const items = notes[version];
    this.items = Array.isArray(items) && items.length > 0 && items.length <= 8 &&
      items.every(item => typeof item === 'string' && item.trim() && item.length <= 300)
      ? [...items] : null;
    this.dismissedVersion = null;
    try {
      if (io.statSync(this.file).size <= 4096) {
        const saved = JSON.parse(io.readFileSync(this.file, 'utf8'));
        if (typeof saved.dismissedVersion === 'string') this.dismissedVersion = saved.dismissedVersion;
      }
    } catch { /* Missing or damaged preferences must not prevent the app opening. */ }
  }

  view() {
    if (!this.items || this.dismissedVersion === this.version) return null;
    return { version: this.version, items: [...this.items] };
  }

  dismiss(version) {
    if (version !== this.version || !this.items) throw new Error('These update notes are no longer current. Reopen the companion and try again.');
    if (this.dismissedVersion === version) return null;
    const temporary = this.file + '.' + randomUUID() + '.tmp';
    try {
      this.io.mkdirSync(this.directory, { recursive: true });
      this.io.writeFileSync(temporary, JSON.stringify({ dismissedVersion: version }) + '\n', { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      this.io.renameSync(temporary, this.file);
    } catch {
      try { this.io.unlinkSync(temporary); } catch {}
      throw new Error('Could not save your update-note preference on this PC. The changes are still shown; try closing this box again.');
    }
    this.dismissedVersion = version;
    return this.view();
  }
}

module.exports = { UpdateNotes };
