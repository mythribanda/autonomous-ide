/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // VS Code Dark Palette
        vscode: {
          bg: '#1E1E1E',          // Primary editor & window background
          sidebar: '#181818',     // Sidebars, explorer, panels, terminal
          panel: '#181818',       // Secondary panels
          border: '#2B2B2B',      // Subtle 1px borders
          hover: '#2A2D2E',       // Hover state
          selection: '#264F78',   // Selected item background
          accent: '#007ACC',      // VS Code Blue primary accent
          accentHover: '#0062A3', // Accent hover state
          text: '#CCCCCC',        // Primary text
          textMuted: '#858585',   // Secondary / inactive text
          textBright: '#FFFFFF',  // Bright / active text
          statusBar: '#007ACC',   // Status bar background
          
          // Technical & Git states
          success: '#89D185',     // Green
          warning: '#CCA700',     // Yellow / Amber
          error: '#F14C4C',       // Red
          info: '#3794FF',        // Light Blue
          gitModified: '#E2C08D', // Git modified tan
          gitAdded: '#89D185',    // Git added green
          gitDeleted: '#F14C4C',  // Git deleted red
          gitRenamed: '#73C991',  // Git renamed teal
        },
        // Backwards compatibility mappings mapped cleanly to VS Code theme
        workspace: {
          950: '#181818',
          900: '#1E1E1E',
          850: '#181818',
          800: '#252526',
          750: '#2A2D2E',
          700: '#264F78',
          600: '#3C3C3C',
          500: '#858585',
          400: '#858585',
          300: '#CCCCCC',
          200: '#E0E0E0',
          100: '#FFFFFF',
        },
        brand: {
          cyan: '#007ACC',
          teal: '#73C991',
          emerald: '#89D185',
          amber: '#CCA700',
          rose: '#F14C4C',
          purple: '#B180D7',
          indigo: '#3794FF',
          blue: '#007ACC',
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Code', 'Cascadia Mono', 'Consolas', 'Courier New', 'monospace'],
      },
      borderRadius: {
        'xs': '2px',
        'sm': '3px',
        'md': '4px',
        'DEFAULT': '4px',
      }
    },
  },
  plugins: [],
}
