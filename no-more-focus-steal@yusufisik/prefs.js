import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class NoMoreFocusStealPreferences extends ExtensionPreferences {
    getPreferencesWidget() {
        return this.buildPreferencesWindow();
    }

    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({
            title: 'Focus Control',
            icon_name: 'dialog-information-symbolic',
        });

        // Whitelist Management Group
        const whitelistGroup = new Adw.PreferencesGroup({
            title: 'Allowed Applications',
            description: 'Manage applications that can steal focus',
        });

        // Create list rows
        const createListRow = (wmClass, enabled) => {
        const row = new Adw.ActionRow({
            title: wmClass,
            subtitle: enabled ? 'Allowed' : 'Blocked',
        });

        const toggle = new Gtk.Switch({
            active: enabled,
            valign: Gtk.Align.CENTER,
        });

        const deleteBtn = new Gtk.Button({
            icon_name: 'user-trash-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
        });

        row.add_suffix(deleteBtn);
        row.add_suffix(toggle);

        // Connect signals
        toggle.connect('notify::active', (sw) => {
            const entries = settings.get_strv('whitelist');
            const newEntries = entries.filter(e => !e.startsWith(`${wmClass}:`));
            newEntries.push(`${wmClass}:${sw.active ? 1 : 0}`);
            settings.set_strv('whitelist', newEntries);
        });

        deleteBtn.connect('clicked', () => {
            const entries = settings.get_strv('whitelist');
            const newEntries = entries.filter(e => !e.startsWith(`${wmClass}:`));
            settings.set_strv('whitelist', newEntries);
            whitelistGroup.remove(row);
        });

        return row;
        };

        // Update UI when settings change
        const updateUI = () => {
            // Remove existing rows
            let child = whitelistGroup.get_first_child();
            while (child !== null) {
                const nextChild = child.get_next_sibling();
                whitelistGroup.remove(child);
                child = nextChild;
            }

            // Add new entries
            settings.get_strv("whitelist").forEach(entry => {
                const [wmClass, enabled] = entry.split(':');
                if (wmClass) {
                whitelistGroup.add(createListRow(wmClass, enabled === '1'));
                }
            });
        };
        settings.connect('changed::whitelist', updateUI);
        updateUI();

        // Add Application Button
        const addButton = new Gtk.Button({
            icon_name: 'list-add-symbolic',
            tooltip_text: 'Add application exception',
            css_classes: ['flat'],
        });

        addButton.connect('clicked', () => {
            const dialog = new Adw.MessageDialog({
                transient_for: window,
                heading: 'Add Application Exception',
                body: 'Enter WM_CLASS identifier (e.g., "gnome-terminal")',
            });

            const entry = new Adw.EntryRow({
                title: 'WM_CLASS:',
            });

            dialog.set_extra_child(entry);
            dialog.add_response('cancel', 'Cancel');
            dialog.add_response('add', 'Add');
            dialog.set_default_response('add');
            dialog.set_response_appearance('add', Adw.ResponseAppearance.SUGGESTED);

            dialog.connect('response', (_, response) => {
                if (response === 'add') {
                const wmClass = entry.get_text().trim();
                if (wmClass) {
                    const entries = settings.get_strv('whitelist');
                    if (!entries.some(e => e.startsWith(`${wmClass}:`))) {
                        settings.set_strv('whitelist', [...entries, `${wmClass}:1`]);
                    }
                }
                }
                dialog.destroy();
            });

            dialog.show();
        });

        whitelistGroup.set_header_suffix(addButton);
        page.add(whitelistGroup);
        window.add(page);
    }
}