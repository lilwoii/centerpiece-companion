const $ = id => document.getElementById(id);
let current, busy = false;
const actionButtons = [...document.querySelectorAll('[data-action]')];
function clock(seconds) { const n = Math.max(0, Math.floor(Number(seconds) || 0)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; }
function render(state) {
  current = state;
  for (const id of ['shortcuts', 'inspect', 'plugin-mode']) if (!$(id).hasAttribute('aria-busy')) $(id).disabled = false;
  $('plugin-mode').textContent = state.navigation.active ? 'Exit plugin mode' : 'Enter plugin mode';
  $('plugin-mode').setAttribute('aria-pressed', String(state.navigation.active));
  $('selection').textContent = state.navigation.active ? `${state.navigation.pluginName} · ${state.navigation.label} — arrows select, Enter runs, Esc exits` : 'Plugin mode is off. Arrow keys type normally.';
  const media = state.media;
  $('connection').textContent = media.available ? 'Spotify connected' : 'Spotify unavailable';
  $('connection').classList.toggle('connected', !!media.available);
  $('track-title').textContent = media.available ? media.title || 'Untitled track' : 'Open Spotify to connect';
  $('artist').textContent = media.available ? media.artist || 'Unknown artist' : media.message || 'Start a track in the Spotify desktop app.';
  $('album').textContent = media.available ? media.album || '' : '';
  $('playback').textContent = media.available ? media.status.toUpperCase() : 'WINDOWS MEDIA SESSION';
  $('position').textContent = clock(media.position); $('duration').textContent = clock(media.duration);
  $('progress').max = Math.max(1, media.duration || 1); $('progress').value = Math.max(0, Math.min(media.position || 0, media.duration || 0));
  $('toggle').textContent = media.status === 'Playing' ? 'Pause' : 'Play';
  for (const button of actionButtons) button.disabled = busy || !media.available || !media.controls?.[button.dataset.action];
  $('shortcuts').textContent = state.shortcuts ? 'Disable shortcuts' : 'Enable shortcuts';
  $('shortcuts').setAttribute('aria-pressed', String(state.shortcuts));
  $('feedback').textContent = state.error || state.feedback || (media.available ? 'Connected locally through Windows. Your Spotify account stays in Spotify.' : media.message);
  $('feedback').classList.toggle('error', !!state.error);
  const device = state.device;
  $('device-status').textContent = device.keyboard && device.display ? 'Keyboard and display interfaces detected.' : device.keyboard ? 'Keyboard detected. Display interface is missing.' : 'Centerpiece not detected. Check its USB connection, then retry.';
  $('versions').textContent = [device.keyboardVersion && `Keyboard ${device.keyboardVersion}`, device.displayVersion && `Display ${device.displayVersion}`].filter(Boolean).join('  ·  ');
  $('device-error').textContent = state.deviceError || device.keyboardError || device.displayError || '';
  $('strip-heading').textContent = state.strip ? 'Plugin strip connected' : 'Keyboard strip is not connected';
  $('strip-detail').textContent = state.strip ? 'Four plugin positions appear on the keyboard. Caps Lock uses preloaded on/off states. The strip uses overlay slots 2–10; your skin stays in place. Close keeps controls running in the tray; Quit restores your previous overlay.' : 'The companion needs the saved setup for this keyboard. Close XPANEL and restart the companion if the display is busy.';
}
for (const button of actionButtons) button.addEventListener('click', async () => {
  if (busy) return; busy = true; render(current);
  try { await window.companion.action('spotify', button.dataset.action); }
  catch (error) { current.error = error.message; }
  finally { busy = false; render(current); }
});
async function pending(button, callback) {
  button.disabled = true; button.setAttribute('aria-busy', 'true');
  try { render(await callback()); } catch (error) { current.error = error.message; render(current); }
  finally { button.disabled = false; button.removeAttribute('aria-busy'); }
}
$('shortcuts').addEventListener('click', () => pending($('shortcuts'), () => window.companion.shortcuts(!current.shortcuts)));
$('inspect').addEventListener('click', () => pending($('inspect'), () => window.companion.inspectDevice()));
$('plugin-mode').addEventListener('click', () => pending($('plugin-mode'), () => window.companion.pluginMode()));
window.companion.subscribe(render);
window.companion.getState().then(render).catch(error => { $('feedback').textContent = error.message; });
