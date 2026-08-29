[![CI](https://github.com/abofs/stonyx-logs/actions/workflows/ci.yml/badge.svg)](https://github.com/abofs/stonyx-logs/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@stonyx/logs.svg)](https://www.npmjs.com/package/@stonyx/logs)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

<h1 align="center">
	<br>
	<br>
	<img width="560" src="https://github.com/abofs/stonyx-logs/raw/main/media/logo.png" alt="Stonyx Logs">
	<br>
	<br>
	<br>
</h1>

> Simplified logging for node applications

![](https://github.com/abofs/stonyx-logs/raw/main/media/screenshot.jpg)

<br>

---

<div align="center">
	<p>
		<p>
			<sup>
			  If our projects are useful to you, please consider becoming a <a href="https://github.com/sponsors/abofs">GitHub Sponsor</a>
			</sup>
		</p>
	</p>
</div>

---

**Log** is built on top of all the great work done by "Sindre Sorhus" and other collaborators of the [chalk](https://www.npmjs.com/package/chalk) project.
This project is not directly associated with chalk other than chalk being a core dependency of **Log**.

**IMPORTANT**: Please note that although **Log** can be configured to any color through chalk, your output is subject to your terminal's color limitations.

## Highlights

- Fully configurable
- Simple and Expressive API
- Highly performant

## Install

```sh
npm install @stonyx/logs
```

## Usage

```js
import Log from '@stonyx/logs';

const log = new Log();

log.info('Info: sample application has started');
log.warn('Warning: this is just a sample');

// logs to logs/error.log; a failed write rejects, and handling that rejection is required
// see "Handling write failures" below
log.error('Error: no application logic detected', true)
  .catch(err => { /* err.code is the underlying fs error code, e.g. 'EACCES' */ });
```

Easily define your own logging mechanism and color-coding preference:

```js
import Log from '@stonyx/logs';

const log = new Log({
  systemLogs: {
    blue: '#007cae', // indigo blue
    yellow: '#ae8f00', // bright orange
    red: 'red',
  },
});

log.blue('Info: using custom method blue, sample application has started');
log.yellow('Warning: using custom method yellow, this is just a sample');
log.red('Error: using custom method red, no application logic detected', false);
```

Customize logging options to best suit your project

```js
import Log from '@stonyx/logs';

const log = new Log({
  logToFileByDefault: true,
  logTimestamp: true,
  path: 'custom-logs', // <project root>/custom-logs/*.log
  prefix: '--------------------------------------------------------------- \n',
  suffix: '\n=============================================================== \n',
});

log.info('Info: sample application has started')
  .catch(err => { /* see "Handling write failures" */ });
```

> **Caveat:** with `logToFileByDefault: true`, every log call *except* [`debug()`](#the-debug-method)
> becomes a file write, and therefore returns a promise that can reject. A failing log directory turns
> an unhandled `log.info()` into a process-terminating rejection. See
> [handling write failures](#handling-write-failures).

![](https://github.com/abofs/stonyx-logs/raw/main/media/examples/custom-options.jpg)


Add additional log types extending the default options of "info", "warn", "error" and "debug"

```js
import Log from '@stonyx/logs';

const log = new Log({ additionalLogs: { question: 'green' } });

// create additional log with direct chalk configuration
log.defineType('query', log.chalk().black.bgGreen);

log.question('What will a fully custom chalk color function look like?');
// second argument writes to file, so this can reject -- see "Handling write failures"
await log.query('This is what a custom chalk color setting looks like', true);
```
![](https://github.com/abofs/stonyx-logs/raw/main/media/examples/additional-logs.jpg)

## API

### Defining Logs & Colors

By default, **Log** is instantiated with the following options:

```js
  additionalLogs: {},
  systemLogs: {
    info: 'cyan',
    warn: 'yellow',
    error: 'red',
  },
```

You can add to a new log/color setting by passing the `additionalLogs` option to the **Log** constructor. Any setting that already exists in `systemLogs` will be replaced, otherwise they will be added.
 
```js
  const log = new Log({ additionalLogs: { info: 'green', custom: 'cyan' } });

  // output configuration:
  {
    info: 'green',
    warn: 'yellow',
    error: 'red',
    custom: 'cyan'
  }
```

**Log** will generate convenience methods for all keys provided, with the corresponding color settings. The example above would create the following convenience methods, for logging:

```js
  log.info() // green output
  log.warn() // yellow output
  log.error() // red output
  log.custom() // cyan output
```

These methods can then be called in your application with [logging parameters](#logging-parameters).

Color settings are handled by determining whether your input is a color name or a hex value (prefixed with **#**). For example, passing `red` as a color setting will utilize `chalk.red`, while passing `#ff0000` would use `chalk.hex('#ff0000')` instead. A [list of available colors](https://github.com/chalk/chalk#colors) can be found in chalks' documentation.

Additionally, these methods return a promise when `logToFile` is true, allowing you to use them with `await` in an async method, or to append `then()`, `catch()` or `finally()`.

When `logToFile` is true that promise **can reject**, and handling the rejection is **required** --
see [handling write failures](#handling-write-failures) for the full contract.

```js
async method() {
  try {
    await log.error('error message', true);

    // do something after logs/error.log (default) is created
  } catch (err) {
    // err.code is the underlying fs error code, e.g. 'EACCES'
  }
}
```

### The Debug Method

**Log** allows for the `log.debug()` method to be overridden by a color setting. However, by default we do not define a color for debug and debug is handled differently. For console logging, all **debug** does is output the following:

```js
// For logging to console:
console.dir(content);

// For writing to file:
JSON.stringify(content, null, 2);
```

We believe that when wanting to output complicated objects or debug **typescript** applications, there are better methods than utilizing this **Log** package. But for anyone who's fully incorporated **Log** into their project, this function offers some convenience.

`debug(content, logToFile)` writes to file on the same contract as every other log type -- a failed
write rejects with the underlying `fs` error and must be handled -- with one difference: `debug()`
ignores [`logToFileByDefault`](#configuration), so it writes to file only when you pass `true`.
See [handling write failures](#handling-write-failures).

### Logging Parameters

```js
log.error('error message', true, false); // content, logToFile, overwrite
```

| Parameter | Type | Default | Description |
| :---: | :---: | :---: | :--- |
| `content` | **String** | | Content of log that will output on your console. |
| `logToFile` | **Boolean** | *false* | Option to log content to file. When true, the call returns a promise that rejects if the write fails -- see [handling write failures](#handling-write-failures). |
| `overwrite` | **Boolean** | *false <br> (true on debug())* | Option to overwrite log file, rather than append to it. This option is redundant if logToFile is false.  |

**logToFile** will log to *<project-root>/logs* unless [configured](#configuration) differently during instantiation. <br>

### Handling Write Failures

Any call that writes to a file returns a promise that **rejects when the write fails**. That covers
`log.error(content, true)`, `log.debug(content, true)`, and every log call except `debug()` when
[`logToFileByDefault`](#configuration) is `true` -- `debug()` is a direct method that never consults
`logToFileByDefault`, so it only writes to file when you pass `true` explicitly.

That rejection is the only actionable failure signal, so every file-writing call must be awaited
inside `try`/`catch`, or have `.catch()` attached. The console line is written *before* the file
write is attempted, so a rejection means only the file copy was lost -- do not re-log the message in
your handler, or it prints twice.

> **A rejection is terminal. Do not retry it.**
>
> For the recoverable directory-level codes -- `ENOENT`, `EACCES`, `EPERM`, `EROFS` -- **Log** has
> already retried internally by the time the rejection reaches you (see
> [self-healing retry](#self-healing-retry) below), so that retry ran and failed too. Every other
> code -- `EISDIR`, `ENOTDIR` and `ENOSPC` among them -- is not itself retried, because a retry
> cannot help it. Either way a consumer-side retry layer races the internal self-heal or repeats a call that
> already cannot succeed, and only delays the disable or back-off that your error path exists to
> trigger.
>
> Treat the **first** rejection as the signal to disable file logging or back off, and do not attempt
> the write again straight away. If you do want file logging to come back without a restart, re-arm
> on a timer -- see [recovering after a latch](#recovering-after-a-latch).

#### What the Promise Rejects With

The rejection value is the underlying Node `fs` error - a `NodeJS.ErrnoException` passed through
unmodified, with `err.code`, `err.syscall`, `err.errno` and `err.path` all preserved.

```js
try {
  await log.error('error message', true);
} catch (err) {
  // err.code is the underlying fs error code, e.g. 'EACCES'
  // err.syscall is the failing call, e.g. 'mkdir' or 'open'
}
```

Codes you are most likely to see are `EACCES` and `EPERM` (no permission to create the log directory
or write the log file), `ENOENT` (the directory disappeared and could not be recreated) and `EROFS`
(read-only filesystem) - but any error the filesystem raises reaches the caller as-is.

**An unhandled rejection terminates your process** under Node's default `--unhandled-rejections=throw`.
A fire-and-forget `log.error('...', true)` pointed at an unwritable log directory exits the process
with `Error: EACCES: permission denied, mkdir '...'`.

The recommended consumer shape is a latch that trips on the first rejection:

```js
let fileLoggingDisabled = false;

async function logError(message) {
  // once file logging has failed, stay on the console
  if (fileLoggingDisabled) return log.error(message);

  try {
    await log.error(message, true);
  } catch (err) {
    // the first rejection is terminal - disable, do not retry
    fileLoggingDisabled = true;
  }
}
```

That latch is deliberately terminal for the lifetime of the process: nothing in it ever re-enables
file logging. Records are degraded rather than lost, because the console line is still written on
every call -- but a consumer using the file sink for audit or compliance should treat the first
rejection as an **alertable** event, or fail closed, rather than degrade silently.

#### Recovering After a Latch

If file logging must come back without a restart, re-arm the latch on a **timer**, never on the next
log call. Hold it closed for a fixed back-off window -- a minute or more, long enough that a
permissions fix or a freed disk has a chance to land -- then let exactly one write through. If that
write rejects, latch again and lengthen the window; if it succeeds, clear the latch. Anything faster
is a consumer-side retry under another name.

This also decides what your operators can see. `log-write-recovered` (see
[structured stderr notices](#structured-stderr-notices)) is emitted **only** on a subsequent
successful write, and a consumer that latches off permanently never issues one. Its entire stderr
output for the episode is a single `log-write-failed` followed by silence, which is indistinguishable
from a failure that self-healed -- so an alert-clear rule keyed on `log-write-recovered` will never
fire for it. Either treat `log-write-failed` as latching on the operator side too, or use the timed
re-arm above, which is what makes a recovery notice reachable at all.

#### Self-Healing Retry

A cached log directory can outlive the directory it describes - for example, something deletes
`logs/` while your process is running. To cover that, a failure whose `err.code` is `ENOENT`,
`EACCES`, `EPERM` or `EROFS` drops the cached directory entry and retries the write **exactly once**.
Any other code -- `EISDIR`, `ENOTDIR`, `ENOSPC`, `EMFILE` and the rest -- does not itself trigger
a retry. The decision is keyed on the *first* attempt's code, so a rejection carrying one of these
can still arrive after a retry if conditions changed mid-call.

A retry that succeeds emits no *failure* notice: the promise resolves normally and the write counts
as a success, closing any failure episode already open for that directory with the usual
`log-write-recovered`. A rejection carrying one of those four codes has therefore already spent its
single retry; every other code was never retryable in the first place. The retry is per call and per
`Log` instance -- independent instances retry independently.

#### Structured stderr Notices

Alongside the rejection, **Log** emits a machine-parseable notice to `stderr` so that operators have
something to key on. The write-failure path must never re-enter the logger itself, so these notices
bypass all formatting and configuration: they are emitted via `console.error` as one JSON object per
line (JSONL), regardless of your color, prefix, suffix or path settings. Anything that wraps or
patches `console.error` sees them too. Notices are informational; the promise rejection is the
failure signal.

| Field | Value |
| :---: | :--- |
| `ts` | ISO-8601 timestamp of the notice |
| `surface` | Always `"stonyx-logs"` |
| `sessionKey` | Always `null` |
| `project` | Always `null` |
| `severity` | `"error"` for a failure, `"warn"` for a recovery |
| `event` | `"log-write-failed"` or `"log-write-recovered"` |
| `payload` | Event-specific, see below |
| `schemaVersion` | Always `1` |

`log-write-failed` payload:

| Field | Description |
| :---: | :--- |
| `targetLog` | Resolved path of the log file that could not be written |
| `path` | Resolved log *directory*, with trailing separator - this is the dedupe key |
| `syscall` | The failing syscall, e.g. `"mkdir"` or `"open"` |
| `code` | The same `err.code` carried by the rejection |
| `cached` | Whether the directory was already cached when the write started |
| `suppressedCount` | Always `0` on a failure notice |

`log-write-recovered` carries `targetLog`, `path` and `suppressedCount` only.

**Dedupe:** notices are one per failure episode, keyed on the resolved directory and scoped to the
`Log` instance -- the failure counters are instance state, so two instances writing to the same
directory emit one notice each. The first failure for a directory emits `log-write-failed`; every
subsequent failure for that same directory is silent. The next successful write to it emits a single
`log-write-recovered` carrying `suppressedCount` - the number of notices that were suppressed, i.e.
`N - 1` for an episode of `N` consecutive failures.
Every failure still rejects its own promise; only the notices are deduped.

Five consecutive failures followed by one success emit exactly these two records:

```jsonl
{"ts":"2026-08-29T23:08:50.343Z","surface":"stonyx-logs","sessionKey":null,"project":null,"severity":"error","event":"log-write-failed","payload":{"targetLog":"/private/tmp/my-app/logs/error.log","path":"/private/tmp/my-app/logs/","syscall":"mkdir","code":"EACCES","cached":false,"suppressedCount":0},"schemaVersion":1}
{"ts":"2026-08-29T23:08:50.344Z","surface":"stonyx-logs","sessionKey":null,"project":null,"severity":"warn","event":"log-write-recovered","payload":{"targetLog":"/private/tmp/my-app/logs/error.log","path":"/private/tmp/my-app/logs/","suppressedCount":4},"schemaVersion":1}
```

### Configuration

When instantiating **Log**, you can pass an object to customize your settings. Below is the default configuration:

```js
const log = new Log({
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
  }
});
```

| Option | Type | Default | Description |
| :---: | :---: | :---: | :--- |
| `logToFileByDefault` | **Boolean** | *false* | Option to change default setting for `logToFile` parameter of logging functions. When true, every log call except `debug()` becomes a rejectable file write -- see [handling write failures](#handling-write-failures). |
| `logTimestamp` | **Boolean** | *false* | Option to include timestamp in console logging. Timestamps are automatically included in file logs. |
| `path` | **String** | *'logs/'* | Path in which to store log files. This setting is relative to your project's root directory. |
| `prefix` | **String** | *''* | Prefix string to prepend all log messages for all log types with the exception of *debug*. |
| `suffix` | **String** | *''* | Suffix string to tack on to all log messages for all log types with the exception of *debug*. |
| `filename` | **String** | *''* | Template for log file names with variable support. Defaults to `{type}.log` when empty. See [dynamic file names](#dynamic-file-names). |
| `additionalLogs` | **Object** | | Key value pair object containing log type to color setting for logs that will be merged with `systemLogs` |
| `systemLogs` | **Object** | | Key value pair object containing log type to color setting for main **Log** logs available in application |

`additionalLogs` and `systemLogs` are explained with more detail in the [defining logs and colors](#defining-logs) section.

### Advanced Configuration

You may want to do more than just pick a basic color for your output. **chalk** offers a variety of different options, and can be configured via `defineType()`. **Log** exposes the chalk instance via `chalk()` so that you don't have to import **chalk** directly into your project. Here is an example of how you can use this method to fully customize your log color setting:

```js
const log = new Log();

log.defineType('critical', log.chalk().bold.red);
log.critical('This is a critical error');
```

Additionally, any [configuration](#configuration) that can be set during instantiation, can also be applied exclusively to any given type by passing in a third **options** parameter.

```js
// params: type, setting, options
log.definetype('notice', '#c0c0c0', {
  prefix: '--------------------------------------------------------------- \n',
  suffix: '\n=============================================================== \n'
});
```

### defineType() params
| Parameter | Type | Description |
| :---: | :---: | :--- |
| `type` | **String** | Create or overwrites a logging function for the given type. |
| `setting` | **String or Function** | Color setting or chalk function |
| `options` | **Object** | Configure any setting only to the given type rather than globally. See [configuration](#configuration) for list of options |


```js
const log = new Log();

log.defineType('info', log.chalk().black.bgCyan);
log.defineType('critical', log.chalk().bold.red);
log.defineType('dialog', 'magentaBright');
log.definetype('notice', '#c0c0c0', {
  prefix: '--------------------------------------------------------------- \n',
  suffix: '\n=============================================================== \n'
});

log.info('This pre-existing log now has a cyan background and black foreground');
log.critical('This new log is bold and red');
log.dialog('This new dialog is bright magenta');
log.notice('This new log is the hex "#c0c0c0" share of gray');
```

`defineType()` can also be used as an alternative to populating the `additionalLogs` setting in the constructor, as if the setting doesn't already exist, it will then be created.

### Dynamic File Names

The `filename` option supports template variables that are resolved at write-time, allowing each log type to produce uniquely named files.

#### Supported Variables

| Variable | Resolves To | Example Output |
| :---: | :--- | :--- |
| `{date}` | Current date in YYYY-MM-DD format | `2026-04-04` |
| `{type}` | Log type name | `error` |
| `{pid}` | Current process ID | `12345` |
| `{hostname}` | Machine hostname | `my-server` |

#### Examples

```js
// Per-type filename via defineType
log.defineType('error', 'red', { filename: 'error-{date}.log' });
// writes to: logs/error-2026-04-04.log

// Per-type filename with multiple variables
log.defineType('info', 'cyan', { filename: '{type}-{hostname}-{date}.log' });
// writes to: logs/info-my-server-2026-04-04.log

// Global filename template via constructor
const log = new Log({ filename: '{type}-{date}.log' });
// all types write to: logs/<type>-2026-04-04.log
```

When no `filename` is configured, the default behavior of `{type}.log` is preserved for full backward compatibility.

Path traversal characters (`..`, `/`, `\`) are automatically stripped from resolved file names for security.

## Origin

As a team of developers who are constantly working on side projects, we often litter our codebase with TODOs to refactor convenience utils such as **@stonyx/logs** into classes of their own, or projects of their own. This usually turns into internal tech debt that never gets addressed. Furthermore, we also often find ourselves going the *copy -> paste -> modify* route of previously written useful logic, which saves us time in new projects, but not as much as it would if all we had to do was run an `npm install` instead. 

With that in mind, we are proud to release **@stonyx/logs** as an open source package, in hopes others will find this just as useful as we do in their own projects.  

## Maintainers

- [Stone Costa](https://github.com/mstonepc)
- [Daniel DeLima](https://github.com/danieldtech)
