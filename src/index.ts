import { mkdirSync, promises as fsp } from 'fs';
import { fileURLToPath } from 'url';
import { hostname } from 'os';
import projectPath from 'path';
import Color, { type ColorSetting, type ChalkColorFn } from './color.js';

export interface LogOptions {
  logToFileByDefault: boolean;
  logTimestamp: boolean;
  path: string;
  prefix: string;
  suffix: string;
  filename: string;
  additionalLogs: Record<string, ColorSetting>;
  systemLogs: Record<string, ColorSetting>;
}

const defaultOptions: LogOptions = {
  logToFileByDefault: false,
  logTimestamp: false,
  path: 'logs/',
  prefix: '',
  suffix: '',
  filename: '',
  additionalLogs: {},
  systemLogs: {
    info: 'cyan',
    warn: 'yellow',
    error: 'red',
  },
};

// used to sanitize defineType() options input
const optionKeys = Object.keys(defaultOptions);

export default class Log {
  options: LogOptions;
  color: Color;
  typeOptions: Record<string, Partial<LogOptions>> = {};

  // Dynamic convenience methods added at runtime
  [key: string]: unknown;

  constructor(options: Partial<LogOptions> = {}) {
    const merged: LogOptions = {
      ...defaultOptions,
      ...options,
    };
    this.options = merged;
    this.options.path = this.sanitizePath(this.options.path);

    const { additionalLogs, systemLogs } = merged;
    const logs: Record<string, ColorSetting> = {
      ...systemLogs,
      ...additionalLogs,
    };

    this.color = new Color();
    this.typeOptions = {};

    // create direct convenience methods for logging
    for (const type of Object.keys(logs)) {
      this.defineType(type, logs[type]);
    }
  }

  // records setting and options for log type, and creates convenience method ie: log.info()
  defineType(type: string, setting: ColorSetting, options: Partial<LogOptions> | null = null): void {
    this.color.setLogColor(type, setting);

    // create convenience method if it doesn't exist
    if (!this[type]) this.createConvenienceMethod(type);

    if (!options) return;
    if (typeof options !== 'object') throw 'The options param must be an object.';

    for (const option of Object.keys(options)) {
      if (!optionKeys.includes(option)) {
        throw `${option} is not a valid configuration object.`
          + '\n For a list of available options, see https://github.com/abofs/stonyx-logs#configuration';
      }

      // sanitize path input
      if (option === 'path') {
        (options as Record<string, unknown>)[option] = this.sanitizePath(
          (options as Record<string, unknown>)[option] as string
        );
      }
    }

    this.typeOptions[type] = options;
  }

  // proxy through `logAction` method in order to set defaults based on argument presence
  createConvenienceMethod(type: string): void {
    (this as Record<string, unknown>)[type] = (content: string, logToFile?: boolean, overwrite = false) =>
      this.logAction(type, content, logToFile, overwrite);
  }

  // validates params and sets configuration-based defaults for logging
  logAction(type: string, content: string, logToFile?: boolean, overwrite?: boolean): Promise<void> {
    // set logToFile default based on class options when not set
    if (logToFile === undefined) logToFile = this.getOptionForType(type, 'logToFileByDefault') as boolean;

    // treat overwrite default as true for log type "debug"
    if (type === 'debug' && overwrite === undefined) overwrite = true;

    return this.log(content, type, logToFile, overwrite ?? false);
  }

  // retrieves option setting for given type, default to global
  getOptionForType(type: string, option: keyof LogOptions): LogOptions[keyof LogOptions] {
    const options = this.typeOptions[type];
    if (!options || !options[option]) return this.options[option];

    return options[option] as LogOptions[keyof LogOptions];
  }

  // exposes chalk for custom color options via defineType
  chalk(): ReturnType<Color['getChalkInstance']> {
    return this.color.getChalkInstance();
  }

  // logs to console, and conditionally to file
  async log(content: string, type: string, logToFile: boolean, overwrite: boolean): Promise<void> {
    const logTimestamp = this.getOptionForType(type, 'logTimestamp') as boolean;
    const timestamp = `[${new Date().toLocaleString('en-US')}]`;
    const chalkColorFunction = this.color.getLogColor(type);
    let prefix = this.getOptionForType(type, 'prefix') as string;
    let suffix = this.getOptionForType(type, 'suffix') as string;
    if (logTimestamp) prefix += `${timestamp} `;
    if (prefix) prefix = chalkColorFunction(prefix);
    if (suffix) suffix = chalkColorFunction(suffix);
    const coloredLog = chalkColorFunction(content);

    console.log(`${prefix}${coloredLog}${suffix}`); // eslint-disable-line no-console

    if (!logToFile) return;

    await this.writeToFile(type, `${timestamp} ${content}\n`, overwrite);
  }

  // direct hardcoded debug method (log to file functionality is limited)
  async debug(content: unknown, logToFile = false, overwrite = true): Promise<void> {
    console.dir(content, { depth: 6 }); // eslint-disable-line no-console

    if (!logToFile) return;

    await this.writeToFile('debug', JSON.stringify(content, null, 2), overwrite);
  }

  async writeToFile(type: string, content: string, overwrite: boolean): Promise<void> {
    const path = this.getOptionForType(type, 'path') as string;
    const filenameTemplate = this.getOptionForType(type, 'filename') as string;
    const resolvedName = this.resolveFilename(filenameTemplate, type);
    const targetLog = `${path}${resolvedName}`;
    await this.validateFileAndDirectory(path, targetLog);

    const fileAction = overwrite ? fsp.writeFile : fsp.appendFile;

    await fileAction(targetLog, content);
  }

  // resolves template variables in a filename string
  resolveFilename(template: string, type: string): string {
    // default to '{type}.log' when no template is configured
    if (!template) return `${type}.log`;

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    const variables: Record<string, string | number> = {
      date: `${yyyy}-${mm}-${dd}`,
      type,
      pid: process.pid,
      hostname: hostname(),
    };

    const resolved = template.replace(/\{(\w+)\}/g, (match, key: string) => {
      return variables[key] !== undefined ? String(variables[key]) : match;
    });

    // sanitize: prevent path traversal and disallow directory separators
    return resolved.replace(/\.\./g, '').replace(/[/\\]/g, '');
  }

  // attempts to create file and/or directory if they don't already exist
  async validateFileAndDirectory(path: string, targetLog: string): Promise<void> {
    const errorMethod = (this.error as ((msg: string) => void) | undefined) || console.error;

    mkdirSync(path, { recursive: true });

    await fsp.access(targetLog).catch(() => {
      fsp.writeFile(targetLog, '').catch(() => {
        errorMethod(`Failed to create log file: ${targetLog}.`
          + '\n Verify that the application runner has write permissions');
      });
    });
  }

  // method to conditionally sanitize user configuration input
  sanitizePath(path: string): string {
    const moduleDir = projectPath.dirname(fileURLToPath(import.meta.url));
    const delim = moduleDir.includes('node_modules') ? 'node_modules' : 'src';
    const splitDir = moduleDir.split(delim);

    if (splitDir.length < 2) throw ('Failed to locate your project\'s root directory.');

    // use project root directory behind path
    path = projectPath.resolve(splitDir[0], path);

    // force path property to contain a trailing "/"
    if (path[path.length - 1] !== '/') {
      path += '/';
    }

    return path;
  }
}
