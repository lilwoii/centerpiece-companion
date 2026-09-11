const fs = require('node:fs');
const path = require('node:path');

function storageError() {
  const error = new Error('Automatic keyboard setup could not check or record its first attempt on this PC. No keyboard settings were changed. Use Set up my keyboard to continue manually.');
  error.code = 'AUTOMATIC_SETUP_STORAGE_UNAVAILABLE';
  return error;
}

class AutomaticSetup {
  constructor({ directory, hardwareDirectory, io = fs }) {
    this.directory = directory;
    this.io = io;
    this.marker = path.join(directory, 'automatic-setup-attempt.json');
    this.hardware = path.join(hardwareDirectory, 'hardware.json');
    this.running = false;
    this.attempted = false;
  }

  exists(file) {
    try { this.io.lstatSync(file); return true; }
    catch (error) { if (error.code === 'ENOENT') return false; throw storageError(); }
  }

  canAttempt() {
    if (this.running || this.attempted) return false;
    // Discovery is read-only and stops conservatively if local state cannot be
    // inspected. Neither missing hardware nor a hidden window consumes an attempt.
    try { return !this.exists(this.marker) && !this.exists(this.hardware); }
    catch { return false; }
  }

  async run({ eligible = false, setup } = {}) {
    if (eligible !== true || !this.canAttempt()) return { attempted: false };
    this.running = true;
    try {
      // Any prior marker, including an incomplete one left by a crash, stops
      // automatic retries. An existing hardware record belongs to manual setup.
      if (typeof setup !== 'function') throw new TypeError('Automatic keyboard setup needs a setup action.');
      try {
        this.io.mkdirSync(this.directory, { recursive: true });
        this.io.writeFileSync(this.marker, JSON.stringify({ format: 1, attemptedAt: new Date().toISOString() }) + '\n', { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      } catch (error) {
        if (error.code === 'EEXIST') { this.attempted = true; return { attempted: false }; }
        // Preserve even a partial marker: failing closed is safer than repeating
        // a hardware action after a crash or storage error.
        throw storageError();
      }
      this.attempted = true;
      return { attempted: true, result: await setup() };
    } finally {
      this.running = false;
    }
  }
}

module.exports = { AutomaticSetup };
