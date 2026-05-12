'use strict';
const { Plugin, MarkdownView, Notice, PluginSettingTab, Setting } = require('obsidian');

const DEFAULT_SETTINGS = {
    showDate: true,
    dateStyle: 'long',  // 'long' | 'short' | 'iso'
    showTime: true,
    timeFormat: '12h',  // '12h' | '24h'
};

class RunningMinutesSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        const preview = containerEl.createEl('p', { cls: 'setting-item-description' });
        preview.style.marginBottom = '1.5em';
        preview.style.fontSize = '0.95em';
        const refresh = () => preview.setText('Preview: [' + this.plugin.timestamp() + ']');
        refresh();

        new Setting(containerEl)
            .setName('Show date')
            .setDesc('Include the date in the timestamp.')
            .addToggle(t => t
                .setValue(this.plugin.settings.showDate)
                .onChange(async v => {
                    this.plugin.settings.showDate = v;
                    await this.plugin.saveSettings();
                    refresh();
                }));

        new Setting(containerEl)
            .setName('Date format')
            .addDropdown(d => d
                .addOption('long',  'Long  — May 11, 2026')
                .addOption('short', 'Short — 5/11/26')
                .addOption('iso',   'ISO   — 2026-05-11')
                .setValue(this.plugin.settings.dateStyle)
                .onChange(async v => {
                    this.plugin.settings.dateStyle = v;
                    await this.plugin.saveSettings();
                    refresh();
                }));

        new Setting(containerEl)
            .setName('Show time')
            .setDesc('Include the time in the timestamp.')
            .addToggle(t => t
                .setValue(this.plugin.settings.showTime)
                .onChange(async v => {
                    this.plugin.settings.showTime = v;
                    await this.plugin.saveSettings();
                    refresh();
                }));

        new Setting(containerEl)
            .setName('Time format')
            .addDropdown(d => d
                .addOption('12h', '12-hour — 2:30 PM')
                .addOption('24h', '24-hour — 14:30')
                .setValue(this.plugin.settings.timeFormat)
                .onChange(async v => {
                    this.plugin.settings.timeFormat = v;
                    await this.plugin.saveSettings();
                    refresh();
                }));
    }
}

class RunningMinutesPlugin extends Plugin {
    active = true;
    pendingStamp = false;
    lastKeystrokeAt = 0;
    settings = { ...DEFAULT_SETTINGS };

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new RunningMinutesSettingTab(this.app, this));

        this.addRibbonIcon('clock', 'Running Minutes (click to toggle)', () => {
            this.active = !this.active;
            this.pendingStamp = false;
            new Notice(`Running Minutes ${this.active ? 'ON ✓' : 'OFF'}`);
        });

        this.addCommand({
            id: 'insert-timestamp',
            name: 'Insert timestamp',
            editorCallback: (editor) => {
                editor.replaceSelection('[' + this.timestamp() + '] ');
            }
        });

        this.registerDomEvent(document, 'keydown', this.onKeyDown.bind(this), true);
        this.registerEvent(this.app.workspace.on('active-leaf-change', () => {
            this.pendingStamp = false;
        }));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    inTitle() {
        return !!document.activeElement?.closest('.inline-title');
    }

    onKeyDown(evt) {
        if (!this.active) return;

        if (evt.key === 'Enter' && !evt.shiftKey && !evt.ctrlKey && !evt.metaKey && !evt.altKey) {
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (!view || view.getMode() !== 'source') return;
            if (document.querySelector('.suggestion-container, .cm-tooltip-autocomplete')) return;
            if (!document.activeElement?.closest('.cm-editor')) return;

            if (this.inTitle()) {
                this.pendingStamp = true;
                this.lastKeystrokeAt = Date.now();
                return;
            }

            evt.preventDefault();
            evt.stopImmediatePropagation();
            view.editor.replaceSelection('\n');
            this.pendingStamp = true;
            this.lastKeystrokeAt = Date.now();
            return;
        }

        if (evt.key.length !== 1 || evt.ctrlKey || evt.metaKey || evt.altKey) {
            if (!['Shift', 'Control', 'Alt', 'Meta'].includes(evt.key)) {
                this.pendingStamp = false;
            }
            return;
        }

        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view || view.getMode() !== 'source') return;
        if (!document.activeElement?.closest('.cm-editor')) return;
        if (this.inTitle()) return;

        const now = Date.now();
        const idle = this.lastKeystrokeAt > 0 && (now - this.lastKeystrokeAt) >= 30_000;
        const stamp = this.pendingStamp || idle;

        this.pendingStamp = false;
        this.lastKeystrokeAt = now;

        if (stamp) {
            evt.preventDefault();
            evt.stopImmediatePropagation();
            view.editor.replaceSelection('[' + this.timestamp() + '] ' + evt.key);
        }
    }

    timestamp() {
        const { showDate, dateStyle, showTime, timeFormat } = this.settings;
        const d = new Date();
        const parts = [];

        if (showDate) {
            if (dateStyle === 'long') {
                const mo = ['Jan','Feb','Mar','Apr','May','Jun',
                            'Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
                parts.push(`${mo} ${d.getDate()}, ${d.getFullYear()}`);
            } else if (dateStyle === 'short') {
                parts.push(`${d.getMonth()+1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`);
            } else {
                const mo  = String(d.getMonth()+1).padStart(2,'0');
                const day = String(d.getDate()).padStart(2,'0');
                parts.push(`${d.getFullYear()}-${mo}-${day}`);
            }
        }

        if (showTime) {
            const min = String(d.getMinutes()).padStart(2,'0');
            if (timeFormat === '24h') {
                parts.push(`${String(d.getHours()).padStart(2,'0')}:${min}`);
            } else {
                let h = d.getHours(), ap = 'AM';
                if (h >= 12) { ap = 'PM'; if (h > 12) h -= 12; }
                if (h === 0) h = 12;
                parts.push(`${h}:${min} ${ap}`);
            }
        }

        return parts.join('  ');
    }

    onunload() {}
}

module.exports = RunningMinutesPlugin;
