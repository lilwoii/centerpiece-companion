const spotify = require('./spotify.cjs');
const plugins = new Map([[spotify.id, spotify]]);
async function execute(pluginId, actionId, context) {
  const plugin = plugins.get(pluginId);
  if (!plugin) throw new Error('Plugin is not installed');
  return plugin.execute(actionId, context);
}
function list() { return [...plugins.values()].map(({ id, name, version, actions }) => ({ id, name, version, actions })); }
module.exports = { execute, list };
