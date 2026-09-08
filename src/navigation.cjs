class PluginNavigation {
  constructor(plugins) { this.plugins = plugins; this.active = false; this.category = 0; this.action = 0; }
  selection() { const plugin = this.plugins[this.category]; return { active: this.active, plugin: plugin.id, pluginName: plugin.name, ...plugin.actions[this.action] }; }
  move(key) {
    if (!this.active) return this.selection();
    if (key === 'Left' || key === 'Right') {
      this.category = (this.category + (key === 'Left' ? -1 : 1) + this.plugins.length) % this.plugins.length;
      this.action = 0;
    } else if (key === 'Up' || key === 'Down') {
      const count = this.plugins[this.category].actions.length;
      this.action = (this.action + (key === 'Up' ? -1 : 1) + count) % count;
    }
    return this.selection();
  }
}
module.exports = { PluginNavigation };
