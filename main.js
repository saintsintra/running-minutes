'use strict';
const { Plugin, MarkdownView, Notice, PluginSettingTab, Setting } = require('obsidian');

const DEFAULT_SETTINGS = {
    showDate: true,
    dateStyle: 'long',
    showDayOfWeek: false,
    showTime: true,
    timeFormat: '12h',
    timePrecision: 'minute',
    meetingNotesMode: false,
    meetingLevels: {
        doubleEnter: 'date',
        enter: 'time',
        tab: 'minute',
    },
};

const LEVEL_OPTIONS = [
    { value: 'date',   label: 'Full date' },
    { value: 'time',   label: 'Time' },
    { value: 'minute', label: 'Minutes only' },
    { value: 'none',   label: 'Nothing' },
];

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
            .setName('Show day of week')
            .setDesc('Prepend the day name to the date — e.g. Monday, May 12, 2026.')
            .addToggle(t => t
                .setValue(this.plugin.settings.showDayOfWeek)
                .onChange(async v => {
                    this.plugin.settings.showDayOfWeek = v;
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

        new Setting(containerEl)
            .setName('Time precision')
            .addDropdown(d => d
                .addOption('hour',    'Hour only — 2 PM')
                .addOption('quarter', 'Nearest quarter-hour — 2:15 PM')
                .addOption('five',    'Nearest 5 minutes — 2:30 PM')
                .addOption('minute',  'To the minute — 2:34 PM')
                .addOption('second',  'To the second — 2:34:52 PM')
                .addOption('ms',      'To the millisecond — 2:34:52.007 PM')
                .setValue(this.plugin.settings.timePrecision)
                .onChange(async v => {
                    this.plugin.settings.timePrecision = v;
                    await this.plugin.saveSettings();
                    refresh();
                }));

        // Meeting Notes Mode
        containerEl.createEl('h3', { text: 'Meeting Notes Mode' });

        new Setting(containerEl)
            .setName('Enable meeting notes mode')
            .setDesc('Assign a different timestamp to each level of your notes hierarchy.')
            .addToggle(t => t
                .setValue(this.plugin.settings.meetingNotesMode)
                .onChange(async v => {
                    this.plugin.settings.meetingNotesMode = v;
                    await this.plugin.saveSettings();
                    refresh();
                }));

        this.buildHierarchyDiagram(containerEl);
    }

    buildHierarchyDiagram(containerEl) {
        const s = this.plugin.settings;

        const wrap = containerEl.createDiv();
        Object.assign(wrap.style, {
            border: '1px solid var(--background-modifier-border)',
            borderRadius: '8px',
            padding: '20px 24px',
            margin: '12px 0 0',
            fontFamily: 'var(--font-interface)',
        });

        const rows = [
            { key: 'doubleEnter', trigger: '⏎⏎', label: 'Double Enter', depth: 0, connector: null },
            { key: 'enter',       trigger: '⏎',  label: 'Enter',        depth: 1, connector: '├──' },
            { key: 'tab',         trigger: '⇥',  label: 'Tab',          depth: 2, connector: '└──' },
        ];

        const ROW_GAP = '14px';
        const INDENT  = 22;
        const BULLET  = '◆';

        rows.forEach((row, i) => {
            const rowEl = wrap.createDiv();
            Object.assign(rowEl.style, {
                display: 'flex',
                alignItems: 'center',
                marginTop: i === 0 ? '0' : ROW_GAP,
            });

            // Vertical guide lines + connector
            if (row.depth > 0) {
                // Level 1 pipe
                const pipe1 = rowEl.createSpan({ text: row.depth === 1 ? '│' : '│' });
                Object.assign(pipe1.style, {
                    color: 'var(--text-muted)',
                    fontFamily: 'monospace',
                    width: `${INDENT}px`,
                    flexShrink: '0',
                    textAlign: 'center',
                });
            }

            if (row.depth === 2) {
                // Extra indent + connector
                const conn = rowEl.createSpan({ text: '└──' });
                Object.assign(conn.style, {
                    color: 'var(--text-muted)',
                    fontFamily: 'monospace',
                    marginRight: '4px',
                    flexShrink: '0',
                });
            } else if (row.depth === 1) {
                const conn = rowEl.createSpan({ text: '├──' });
                Object.assign(conn.style, {
                    color: 'var(--text-muted)',
                    fontFamily: 'monospace',
                    marginRight: '4px',
                    flexShrink: '0',
                });
            }

            // Bullet
            const bullet = rowEl.createSpan({ text: BULLET });
            Object.assign(bullet.style, {
                color: 'var(--interactive-accent)',
                marginRight: '10px',
                fontSize: '0.7em',
                flexShrink: '0',
            });

            // Trigger key badge
            const badge = rowEl.createSpan({ text: row.trigger });
            Object.assign(badge.style, {
                background: 'var(--background-secondary)',
                border: '1px solid var(--background-modifier-border)',
                borderRadius: '4px',
                padding: '1px 6px',
                fontSize: '0.8em',
                fontFamily: 'monospace',
                marginRight: '8px',
                flexShrink: '0',
            });

            // Label
            const labelEl = rowEl.createSpan({ text: row.label });
            Object.assign(labelEl.style, {
                flex: '1',
                fontSize: '0.9em',
                color: 'var(--text-normal)',
            });

            // Arrow
            const arrow = rowEl.createSpan({ text: '→' });
            Object.assign(arrow.style, {
                color: 'var(--text-muted)',
                margin: '0 12px',
                flexShrink: '0',
            });

            // Dropdown
            const sel = rowEl.createEl('select');
            Object.assign(sel.style, {
                background: 'var(--background-secondary)',
                border: '1px solid var(--background-modifier-border)',
                borderRadius: '4px',
                padding: '4px 8px',
                color: 'var(--text-normal)',
                fontSize: '0.85em',
                cursor: 'pointer',
            });

            for (const opt of LEVEL_OPTIONS) {
                const o = sel.createEl('option', { value: opt.value, text: opt.label });
                if (s.meetingLevels[row.key] === opt.value) o.selected = true;
            }

            sel.addEventListener('change', async () => {
                this.plugin.settings.meetingLevels[row.key] = sel.value;
                await this.plugin.saveSettings();
            });
        });
    }
}

class RunningMinutesPlugin extends Plugin {
    active = true;
    pendingStamp = false; // false | 'date' | 'time' | 'minute' | 'none'
    lastKeystrokeAt = 0;
    settings = { ...DEFAULT_SETTINGS, meetingLevels: { ...DEFAULT_SETTINGS.meetingLevels } };

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
        const saved = await this.loadData();
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            saved,
            { meetingLevels: Object.assign({}, DEFAULT_SETTINGS.meetingLevels, saved?.meetingLevels) }
        );
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    inTitle() {
        return !!document.activeElement?.closest('.inline-title');
    }

    onKeyDown(evt) {
        if (!this.active) return;
        const { meetingNotesMode, meetingLevels } = this.settings;

        if (evt.key === 'Enter' && !evt.shiftKey && !evt.ctrlKey && !evt.metaKey && !evt.altKey) {
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (!view || view.getMode() !== 'source') return;
            if (document.querySelector('.suggestion-container, .cm-tooltip-autocomplete')) return;
            if (!document.activeElement?.closest('.cm-editor')) return;

            if (this.inTitle()) {
                this.pendingStamp = meetingNotesMode ? meetingLevels.enter : 'time';
                this.lastKeystrokeAt = Date.now();
                return;
            }

            // Double Enter in meeting notes mode → upgrade level
            if (meetingNotesMode && this.pendingStamp) {
                this.pendingStamp = meetingLevels.doubleEnter;
                evt.preventDefault();
                evt.stopImmediatePropagation();
                view.editor.replaceSelection('\n');
                return;
            }

            evt.preventDefault();
            evt.stopImmediatePropagation();
            view.editor.replaceSelection('\n');
            this.pendingStamp = meetingNotesMode ? meetingLevels.enter : 'time';
            this.lastKeystrokeAt = Date.now();
            return;
        }

        // Tab while stamp pending → assign tab level, let Tab indent normally
        if (meetingNotesMode && evt.key === 'Tab' && this.pendingStamp) {
            this.pendingStamp = meetingLevels.tab;
            return;
        }

        // Non-printable keys → cancel
        if (evt.key.length !== 1 || evt.ctrlKey || evt.metaKey || evt.altKey) {
            if (!['Shift', 'Control', 'Alt', 'Meta'].includes(evt.key)) {
                this.pendingStamp = false;
            }
            return;
        }

        // Printable character
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view || view.getMode() !== 'source') return;
        if (!document.activeElement?.closest('.cm-editor')) return;
        if (this.inTitle()) return;

        const now = Date.now();
        const idle = this.lastKeystrokeAt > 0 && (now - this.lastKeystrokeAt) >= 30_000;
        const stampLevel = this.pendingStamp || (idle ? 'time' : false);

        this.pendingStamp = false;
        this.lastKeystrokeAt = now;

        if (stampLevel && stampLevel !== 'none') {
            evt.preventDefault();
            evt.stopImmediatePropagation();
            const ts = meetingNotesMode ? this.timestampForLevel(stampLevel) : this.timestamp();
            view.editor.replaceSelection('[' + ts + '] ' + evt.key);
        }
    }

    timestampForLevel(level) {
        const { dateStyle, showDayOfWeek, timeFormat } = this.settings;
        const d = new Date();
        const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

        if (level === 'minute') {
            return `:${String(d.getMinutes()).padStart(2,'0')}`;
        }

        if (level === 'date') {
            const dow = showDayOfWeek ? DAYS[d.getDay()] + ', ' : '';
            if (dateStyle === 'short') {
                return `${dow}${d.getMonth()+1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
            } else if (dateStyle === 'iso') {
                const mo  = String(d.getMonth()+1).padStart(2,'0');
                const day = String(d.getDate()).padStart(2,'0');
                return `${dow}${d.getFullYear()}-${mo}-${day}`;
            } else {
                return `${dow}${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
            }
        }

        // 'time'
        const min = String(d.getMinutes()).padStart(2,'0');
        if (timeFormat === '24h') {
            return `${String(d.getHours()).padStart(2,'0')}:${min}`;
        }
        let h = d.getHours(), ap = 'AM';
        if (h >= 12) { ap = 'PM'; if (h > 12) h -= 12; }
        if (h === 0) h = 12;
        return `${h}:${min} ${ap}`;
    }

    timestamp() {
        const { showDate, dateStyle, showDayOfWeek, showTime, timeFormat, timePrecision } = this.settings;
        const d = new Date();
        const parts = [];
        const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

        if (showDate) {
            const dow = showDayOfWeek ? DAYS[d.getDay()] + ', ' : '';
            if (dateStyle === 'long') {
                parts.push(`${dow}${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`);
            } else if (dateStyle === 'short') {
                parts.push(`${dow}${d.getMonth()+1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`);
            } else {
                const mo  = String(d.getMonth()+1).padStart(2,'0');
                const day = String(d.getDate()).padStart(2,'0');
                parts.push(`${dow}${d.getFullYear()}-${mo}-${day}`);
            }
        }

        if (showTime) {
            let h = d.getHours();
            let m = d.getMinutes();
            const s  = d.getSeconds();
            const ms = d.getMilliseconds();

            if (timePrecision === 'quarter') {
                m = Math.round(m / 15) * 15;
                if (m === 60) { m = 0; h = (h + 1) % 24; }
            } else if (timePrecision === 'five') {
                m = Math.round(m / 5) * 5;
                if (m === 60) { m = 0; h = (h + 1) % 24; }
            }

            const minStr = String(m).padStart(2,'0');
            const secStr = String(s).padStart(2,'0');
            const msStr  = String(ms).padStart(3,'0');

            if (timeFormat === '24h') {
                const hStr = String(h).padStart(2,'0');
                if (timePrecision === 'hour')        parts.push(hStr);
                else if (timePrecision === 'second') parts.push(`${hStr}:${minStr}:${secStr}`);
                else if (timePrecision === 'ms')     parts.push(`${hStr}:${minStr}:${secStr}.${msStr}`);
                else                                 parts.push(`${hStr}:${minStr}`);
            } else {
                let ap = 'AM';
                if (h >= 12) { ap = 'PM'; if (h > 12) h -= 12; }
                if (h === 0) h = 12;
                if (timePrecision === 'hour')        parts.push(`${h} ${ap}`);
                else if (timePrecision === 'second') parts.push(`${h}:${minStr}:${secStr} ${ap}`);
                else if (timePrecision === 'ms')     parts.push(`${h}:${minStr}:${secStr}.${msStr} ${ap}`);
                else                                 parts.push(`${h}:${minStr} ${ap}`);
            }
        }

        return parts.join('  ');
    }

    onunload() {}
}

module.exports = RunningMinutesPlugin;
