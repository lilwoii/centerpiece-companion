module.exports = {
  id: 'spotify',
  name: 'Spotify',
  version: '0.1.0',
  actions: [
    { id: 'previous', label: 'Previous track', shortcut: 'Control+Alt+Left' },
    { id: 'toggle', label: 'Play / pause', shortcut: 'Control+Alt+Space' },
    { id: 'next', label: 'Next track', shortcut: 'Control+Alt+Right' }
  ],
  async execute(action, context) {
    if (!this.actions.some(item => item.id === action)) throw new Error('Unknown Spotify action');
    return context.media.request(action);
  }
};
