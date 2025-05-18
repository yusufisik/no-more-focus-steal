/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import Gio from "gi://Gio";

export default class NoMoreFocusSteal extends Extension {
    constructor(metadata) {
        super(metadata);
        this._wmSettings = null;
        //this._originalFocusMode = null;
        this._whitelist = [];
        this._windowDemandsAttentionId = null;
        this._windowMarkedUrgentId = null;
        this._settingsChangedId = null;
    }

    enable() {
        // Set strict focus mode
        this._wmSettings = new Gio.Settings({
            schema_id: "org.gnome.desktop.wm.preferences",
        });
        //this._originalFocusMode = this._wmSettings.get_string("focus-new-windows");
        this._wmSettings.set_string("focus-new-windows", "strict");

        // Load initial whitelist
        this._settings = this.getSettings();
        this._onSettingsChanged();

        // Connect to settings changes
        this._settingsChangedId = this._settings.connect(
            "changed::whitelist",
            this._onSettingsChanged.bind(this)
        );


        // Connect to window attention signals
        this._windowDemandsAttentionId = global.display.connect(
            "window-demands-attention",
            this._onWindowDemandsAttention.bind(this)
        );

        this._windowMarkedUrgentId = global.display.connect(
            "window-marked-urgent",
            this._onWindowDemandsAttention.bind(this)
        );
    }

    disable() {
        // Restore focus mode
        if (this._wmSettings) {
            //this._wmSettings.set_string("focus-new-windows", this._originalFocusMode);
            this._wmSettings.set_string("focus-new-windows", "smart");
            this._wmSettings = null;
        }

        // Disconnect signals
        global.display.disconnect(this._windowDemandsAttentionId);
        global.display.disconnect(this._windowMarkedUrgentId);
        
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }

        this._settings = null;
        this._whitelist = [];
    }

    _onWindowDemandsAttention(display, window) {
        //if (!window || window.has_focus() || window.is_skip_taskbar()) return;
        if (!window) return;

        const wmClass = window.get_wm_class();
        if (!wmClass)
        {
            console.log("Could not get wm class!");
            window.unset_urgent();

            const tracker = Main.get_window_actor_tracker();
            const actor = tracker.get_window_actor(window);
            if (actor) {
                actor.deactivate();
            }
        }

        console.log(`Detected WM_CLASS: ${wmClass}`);

        let entry = this._whitelist.find(e => e.wmClass === wmClass);

        // Automatically add to whitelist as disabled if not present
        if (!entry) {
            const currentEntries = this._settings.get_strv('whitelist');
            const exists = currentEntries.some(e => e.startsWith(`${wmClass}:`));
            if (!exists) {
                currentEntries.push(`${wmClass}:0`);
                this._settings.set_strv('whitelist', currentEntries);
                // Update local entry reference after adding
                entry = { wmClass, enabled: false };
            }
        }

        if (entry?.enabled) {
            Main.activateWindow(window);
        } else {
            window.unset_urgent();

            const tracker = Main.get_window_actor_tracker();
            const actor = tracker.get_window_actor(window);
            if (actor) {
                actor.deactivate();
            }
        }
    }

    _onSettingsChanged() {
        this._whitelist = this._settings.get_strv("whitelist")
        .map(entry => {
            const [wmClass, enabled] = entry.split(':');
            return {
                wmClass: wmClass?.trim(),
                enabled: enabled === '1'
            };
        })
        .filter(entry => entry.wmClass);
    }
}
