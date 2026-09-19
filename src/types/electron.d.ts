export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ElectronAPI {
  openFolder: () => Promise<string | null>;
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<boolean>;
  listFiles: (dir: string, recursive?: boolean) => Promise<string[]>;
  executeCommand: (cmd: string, cwd?: string, timeoutMs?: number) => Promise<CommandResult>;
  openExternal?: (url: string) => Promise<void>;
  onAgentEvent: (callback: (data: any) => void) => void;
  removeAgentEventListener: (callback?: (data: any) => void) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
