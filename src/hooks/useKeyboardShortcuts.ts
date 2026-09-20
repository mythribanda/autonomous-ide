import { useEffect } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { useUIStore } from '../stores/uiStore';
import { useTerminalStore } from '../stores/terminalStore';

/** Maps shortcut IDs to human-readable names */
export const SHORTCUT_LABELS: Record<string, string> = {
  focus_prompt: 'Ctrl+P — Focus Prompt Bar',
  toggle_terminal: 'Ctrl+` — Toggle Terminal',
  toggle_explorer: 'Ctrl+Shift+E — Toggle Explorer',
  open_git: 'Ctrl+Shift+G — Open Git',
  open_settings: 'Ctrl+, — Settings',
  command_palette: 'Ctrl+Shift+P — Command Palette',
};

export function useKeyboardShortcuts() {
  const { openSettings } = useSettingsStore();
  const { setActiveView } = useUIStore();
  const { toggleOpen: toggleTerminal } = useTerminalStore();

  useEffect(() => {
    /** Handle shortcuts fired from Electron's globalShortcut */
    const handleShortcutFired = (shortcutId: string) => {
      switch (shortcutId) {
        case 'focus_prompt':
          // Focus the prompt textarea if it exists
          (document.querySelector('[data-prompt-input]') as HTMLElement | null)?.focus();
          break;
        case 'toggle_terminal':
          if (typeof toggleTerminal === 'function') toggleTerminal();
          break;
        case 'toggle_explorer':
          setActiveView('explorer');
          break;
        case 'open_git':
          setActiveView('git');
          break;
        case 'open_settings':
          openSettings();
          break;
        case 'command_palette':
          // TODO: open command palette modal when implemented
          break;
      }
    };

    // Listen to Electron IPC shortcut events
    // Note: onShortcut is an optional extension not in the base ElectronAPI type;
    // cast to any to support future Electron preload additions gracefully.
    const electronAPI = (window as any).electronAPI;
    if (typeof window !== 'undefined' && electronAPI?.onShortcut) {
      electronAPI.onShortcut(handleShortcutFired);
    }

    // Also handle raw keydown events for non-Electron (web mode)
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      if (ctrl && !shift && e.key === 'p') {
        e.preventDefault();
        handleShortcutFired('focus_prompt');
      } else if (ctrl && e.key === '`') {
        e.preventDefault();
        handleShortcutFired('toggle_terminal');
      } else if (ctrl && shift && e.key === 'E') {
        e.preventDefault();
        handleShortcutFired('toggle_explorer');
      } else if (ctrl && shift && e.key === 'G') {
        e.preventDefault();
        handleShortcutFired('open_git');
      } else if (ctrl && !shift && e.key === ',') {
        e.preventDefault();
        handleShortcutFired('open_settings');
      } else if (ctrl && shift && e.key === 'P') {
        e.preventDefault();
        handleShortcutFired('command_palette');
      }
      // Escape — handled by individual modal components
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openSettings, setActiveView, toggleTerminal]);
}
