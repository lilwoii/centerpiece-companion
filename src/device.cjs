const HID = require('./hid.cjs');

function identify(devices) {
  const matching = devices.filter(d => d.vendorId === 0x361d && d.usagePage === 0xff00 && d.usage === 1);
  return { keyboard: matching.find(d => d.productId === 0x0200), display: matching.find(d => d.productId === 0x0202) };
}

// Only the version queries observed in XPANEL are exposed. No general write API.
function versionQuery(device, kind) {
  return new Promise((resolve, reject) => {
    let handle, timer, finished = false;
    const done = (error, result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try { handle?.close(); } catch {}
      error ? reject(error) : resolve(result);
    };
    try {
      handle = new HID.HID(device.path);
      timer = setTimeout(() => done(new Error('Version query timed out. Close XPANEL and retry.')), 2500);
      handle.on('error', error => done(error));
      handle.on('data', data => {
        if (kind === 'display' && data[0] === 3 && data[3] === 54) {
          const length = data.readUInt16LE(1);
          if (length > data.length - 4) return;
          done(null, data.subarray(4, 4 + length).toString('utf8').replace(/\0.*$/s, ''));
        } else if (kind === 'keyboard' && data[0] === 4 && data[2] === 0xf1 && data[3] === 20) {
          done(null, data.subarray(4, Math.min(data.length, 2 + data[1])).toString('utf8').replace(/\0.*$/s, ''));
        }
      });
      const packet = Buffer.alloc(kind === 'display' ? 1024 : 64);
      if (kind === 'display') { packet[0] = 1; packet[3] = 54; }
      else { packet[0] = 3; packet[1] = 2; packet[2] = 0xf0; packet[3] = 20; }
      handle.write([...packet]);
    } catch (error) { done(error); }
  });
}

async function inspectDevice(queryVersions = false) {
  const devices = identify(await HID.devicesAsync());
  const result = { keyboard: !!devices.keyboard, display: !!devices.display, displayIntegration: false };
  if (queryVersions) {
    for (const kind of ['keyboard', 'display']) {
      if (!devices[kind]) continue;
      try { result[`${kind}Version`] = await versionQuery(devices[kind], kind); }
      catch (error) { result[`${kind}Error`] = error.message; }
    }
  }
  return result;
}

module.exports = { identify, inspectDevice };
