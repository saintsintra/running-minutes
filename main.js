'use strict';
const { Plugin, MarkdownView, Notice } = require('obsidian');

class RunningMinutesPlugin extends Plugin {
    active = true;
    pendingStamp = false;   // true after Enter, until first printable key
    lastKeystrokeAt = 0;   // ms timestamp of last printable key

    async onload() {
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

    inTitle() {
        return !!document.activeElement?.closest('.inline-title');
    }

    onKeyDown(evt) {
        if (!this.active) return;

        // Enter → next printable key on the new line gets a stamp
        if (evt.key === 'Enter' && !evt.shiftKey && !evt.ctrlKey && !evt.metaKey && !evt.altKey) {
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (!view || view.getMode() !== 'source') return;
            if (document.querySelector('.suggestion-container, .cm-tooltip-autocomplete')) return;
            if (!document.activeElement?.closest('.cm-editor')) return;
            if (this.inTitle()) return;

            evt.preventDefault();
            evt.stopImmediatePropagation();
            view.editor.replaceSelection('\n');
            this.pendingStamp = true;
            this.lastKeystrokeAt = Date.now();
            return;
        }

        // Non-printable, non-Enter key (arrows, backspace, etc.) — cancel pending stamp
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
        const d = new Date();
        const mo = ['Jan','Feb','Mar','Apr','May','Jun',
                    'Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
        let h = d.getHours(), ap = 'AM';
        if (h >= 12) { ap = 'PM'; if (h > 12) h -= 12; }
        if (h === 0) h = 12;
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${mo} ${d.getDate()}, ${d.getFullYear()}  ${h}:${min} ${ap}`;
    }

    onunload() {}
}

module.exports = RunningMinutesPlugin;
