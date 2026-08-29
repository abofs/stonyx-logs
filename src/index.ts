import { promises as fsp } from 'fs';
import { fileURLToPath } from 'url';
import { hostname } from 'os';
import projectPath from 'path';
import Color, { type ColorSetting, type ChalkColorFn } from './color.js';

// closed severity ladder from the framework logging schema - `critical` is deliberately absent
export type Severity = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

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

  // resolved directory -> in-flight or settled mkdir; instance-scoped so it cannot outlive its directory
  directoryCache: Map<string, Promise<void>> = new Map();

  // resolved directory -> consecutive write failures, used to dedupe the operator notice
  writeFailures: Map<string, number> = new Map();

  // Dynamic convenience methods added at runtime
  [key: string]: unknown;

  // Explicit declarations for system-defined log types so they remain callable under strict mode.

  /**
   * Logs `content` to the console in the `info` color, and to file when `logToFile` is true.
   *
   * **A failed file write rejects the returned promise, and that rejection is terminal - do not retry
   * it.** `ENOENT`, `EACCES`, `EPERM` and `EROFS` have already been retried once internally by the
   * time one reaches you; every other code (`EISDIR`, `ENOTDIR`, `ENOSPC`, `EMFILE`, ...) is never
   * retried, because a retry cannot help it. Handle the first rejection by disabling file logging or
   * backing off - never by writing again. The rejection value is the underlying
   * `NodeJS.ErrnoException` with `err.code` preserved, and leaving it unhandled terminates the
   * process.
   *
   * @see https://github.com/abofs/stonyx-logs#handling-write-failures
   */
  declare info: (content: string, logToFile?: boolean, overwrite?: boolean) => Promise<void>;

  /**
   * Logs `content` to the console in the `warn` color, and to file when `logToFile` is true.
   *
   * **A failed file write rejects the returned promise, and that rejection is terminal - do not retry
   * it.** `ENOENT`, `EACCES`, `EPERM` and `EROFS` have already been retried once internally by the
   * time one reaches you; every other code (`EISDIR`, `ENOTDIR`, `ENOSPC`, `EMFILE`, ...) is never
   * retried, because a retry cannot help it. Handle the first rejection by disabling file logging or
   * backing off - never by writing again. The rejection value is the underlying
   * `NodeJS.ErrnoException` with `err.code` preserved, and leaving it unhandled terminates the
   * process.
   *
   * @see https://github.com/abofs/stonyx-logs#handling-write-failures
   */
  declare warn: (content: string, logToFile?: boolean, overwrite?: boolean) => Promise<void>;

  /**
   * Logs `content` to the console in the `error` color, and to file when `logToFile` is true.
   *
   * **A failed file write rejects the returned promise, and that rejection is terminal - do not retry
   * it.** `ENOENT`, `EACCES`, `EPERM` and `EROFS` have already been retried once internally by the
   * time one reaches you; every other code (`EISDIR`, `ENOTDIR`, `ENOSPC`, `EMFILE`, ...) is never
   * retried, because a retry cannot help it. Handle the first rejection by disabling file logging or
   * backing off - never by writing again. The rejection value is the underlying
   * `NodeJS.ErrnoException` with `err.code` preserved, and leaving it unhandled terminates the
   * process.
   *
   * @see https://github.com/abofs/stonyx-logs#handling-write-failures
   */
  declare error: (content: string, logToFile?: boolean, overwrite?: boolean) => Promise<void>;

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
    if (typeof options !== 'object') throw new Error('The options param must be an object.');

    for (const option of Object.keys(options)) {
      if (!optionKeys.includes(option)) {
        throw new Error(`${option} is not a valid configuration object.`
          + '\n For a list of available options, see https://github.com/abofs/stonyx-logs#configuration');
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

  /**
   * Validates params and applies configuration-based defaults for logging. Every convenience method
   * created by `defineType` - including `info`, `warn` and `error` - routes through here. Note that
   * `debug` does not: it is a direct method that never consults `logToFileByDefault`.
   *
   * **A failed file write rejects the returned promise, and that rejection is terminal - do not retry
   * it.** `ENOENT`, `EACCES`, `EPERM` and `EROFS` have already been retried once internally by the
   * time one reaches you; every other code (`EISDIR`, `ENOTDIR`, `ENOSPC`, `EMFILE`, ...) is never
   * retried, because a retry cannot help it. Handle the first rejection by disabling file logging or
   * backing off - never by writing again. The rejection value is the underlying
   * `NodeJS.ErrnoException` with `err.code` preserved, and leaving it unhandled terminates the
   * process.
   *
   * @see https://github.com/abofs/stonyx-logs#handling-write-failures
   */
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

  /**
   * Logs to console, and conditionally to file.
   *
   * When `logToFile` is true this awaits `writeToFile` and propagates its rejection unchanged, so
   * the caller receives the underlying `NodeJS.ErrnoException`. Callers must handle it: see the
   * `writeToFile` contract below.
   */
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

  /**
   * Direct hardcoded debug method (limited file logging). Unlike the `defineType` convenience
   * methods this does not route through `logAction`, so it never consults `logToFileByDefault` and
   * only writes to file when `logToFile` is passed explicitly.
   *
   * When `logToFile` is true this awaits `writeToFile` and propagates its rejection unchanged, on
   * exactly the same contract as `log` - see `writeToFile` below.
   */
  async debug(content: unknown, logToFile = false, overwrite = true): Promise<void> {
    console.dir(content, { depth: 6 }); // eslint-disable-line no-console

    if (!logToFile) return;

    await this.writeToFile('debug', JSON.stringify(content, null, 2), overwrite);
  }

  /**
   * Writes `content` to the resolved target for `type`, creating the target's directory on first
   * use for that directory.
   *
   * The returned promise rejecting with the underlying `NodeJS.ErrnoException` (with `err.code`
   * preserved) is the sole failure signal - callers that care must handle it. The structured
   * stderr notice emitted alongside a failure is informational only and is deduped per episode.
   *
   * On `ENOENT`, `EACCES`, `EPERM` or `EROFS` the cached directory entry is dropped and the write
   * is retried exactly once. Other codes do not themselves trigger a retry; the decision is keyed
   * on the first attempt's code.
   *
   * A rejection is terminal either way. For those four codes the self-heal has already run and
   * failed by the time one escapes; the rest were never retryable, so repeating the call cannot
   * change the outcome. Consumers must not layer their own retry on top - doing so either races the
   * internal one or repeats a call that already cannot succeed, and delays the disable/back-off the
   * rejection exists to trigger. The correct response to the first rejection is to stop writing.
   * See README "Handling write failures".
   */
  async writeToFile(type: string, content: string, overwrite: boolean): Promise<void> {
    const path = this.getOptionForType(type, 'path') as string;
    const filenameTemplate = this.getOptionForType(type, 'filename') as string;
    const targetLog = `${path}${this.resolveFilename(filenameTemplate, type)}`;
    const cached = this.directoryCache.has(path);
    const attempt = async (): Promise<void> => {
      await this.validateFileAndDirectory(path, targetLog);
      await (overwrite ? fsp.writeFile : fsp.appendFile)(targetLog, content);
    };

    try {
      await attempt().catch(async (error: NodeJS.ErrnoException) => {
        // a warm cache can outlive its directory, so drop the entry and retry exactly once
        if (!['ENOENT', 'EACCES', 'EPERM', 'EROFS'].includes(error?.code as string)) throw error;
        this.directoryCache.delete(path);

        return attempt();
      });
    } catch (error) {
      const { code, syscall } = error as NodeJS.ErrnoException;

      this.noticeWriteResult(path, targetLog, {
        targetLog,
        path,
        syscall,
        code,
        cached,
      });

      throw error;
    }

    this.noticeWriteResult(path, targetLog, null);
  }

  /**
   * One structured stderr notice per failure episode: an emit on the first failure, silence while
   * it keeps failing, one recovery emit on the next success. A null payload records a success.
   *
   * Keyed on the directory rather than the resolved target, matching `directoryCache`: every code
   * in the retry allowlist is a directory-level condition, so keying on the target would strand an
   * un-reaped entry - and silently drop its suppressed count - whenever a `{date}` template rotates
   * away from a still-failing filename.
   */
  noticeWriteResult(path: string, targetLog: string, payload: Record<string, unknown> | null): void {
    const failures = this.writeFailures.get(path) ?? 0;

    if (payload) {
      this.writeFailures.set(path, failures + 1);

      if (!failures) {
        this.emitNotice('error', 'log-write-failed', {
          ...payload,
          suppressedCount: 0,
        });
      }
    } else if (failures) {
      this.writeFailures.delete(path);

      this.emitNotice('warn', 'log-write-recovered', {
        targetLog,
        path,
        suppressedCount: failures - 1,
      });
    }
  }

  /**
   * The write-failure path must never re-enter this logger, so notices go straight out through
   * `console.error` as a single JSONL record, bypassing all of this package's formatting. Field
   * order is the canonical one mandated by the framework logging schema, with the optional
   * `schemaVersion` last.
   */
  emitNotice(severity: Severity, event: string, payload: Record<string, unknown>): void {
    const ts = new Date().toISOString();

    console.error(JSON.stringify({
      ts,
      surface: 'stonyx-logs',
      sessionKey: null,
      project: null,
      severity,
      event,
      payload,
      schemaVersion: 1,
    }));
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

  /**
   * Ensures the target's directory exists. Both write paths auto-create the file itself, so no
   * bootstrap write is needed. `targetLog` is unused but retained for signature compatibility:
   * resolveFilename strips separators, so the only cached invariant is the directory.
   */
  async validateFileAndDirectory(path: string, targetLog: string): Promise<void> {
    let pending = this.directoryCache.get(path);

    if (!pending) {
      // cache the promise before awaiting: a flag here would let a concurrent write append first
      pending = fsp.mkdir(path, { recursive: true }).then(() => undefined);
      this.directoryCache.set(path, pending);

      // never keep a poisoned entry - the next write retries from scratch
      pending.catch(() => this.directoryCache.delete(path));
    }

    return pending;
  }

  // method to conditionally sanitize user configuration input
  sanitizePath(path: string): string {
    const moduleDir = projectPath.dirname(fileURLToPath(import.meta.url));
    const delim = moduleDir.includes('node_modules') ? 'node_modules' : 'src';
    const splitDir = moduleDir.split(delim);

    if (splitDir.length < 2) throw new Error('Failed to locate your project\'s root directory.');

    // use project root directory behind path
    path = projectPath.resolve(splitDir[0], path);

    // force path property to contain a trailing "/"
    if (path[path.length - 1] !== '/') {
      path += '/';
    }

    return path;
  }
}
