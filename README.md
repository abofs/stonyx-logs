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
log.error('Error: no application logic detected', true); // logs to logs/error.log file
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

log.info('Info: sample application has started');
```
![](https://github.com/abofs/stonyx-logs/raw/main/media/examples/custom-options.jpg)


Add additional log types extending the default options of "info", "warn", "error" and "debug"

```js
import Log from '@stonyx/logs';

const log = new Log({ additionalLogs: { question: 'green' } });

// create additional log with direct chalk configuration
log.defineType('query', log.chalk().black.bgGreen);

log.question('What will a fully custom chalk color function look like?');
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

Additionally, these methods return a promise when `logToFile` is true, allowing you use them with `await` in an async method, or append `then(), catch(), or finally()` for more advanced callback usage.

```js
async method() {
  await log.error('error message', true);

  // do something after logs/error.log (default) is created
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

### Logging Parameters

```js
log.error('error message', true, false); // content, logToFile, overwrite
```

| Parameter | Type | Default | Description |
| :---: | :---: | :---: | :--- |
| `content` | **String** | | Content of log that will output on your console. |
| `logToFile` | **Boolean** | *false* | Option to log content to file. |
| `overwrite` | **Boolean** | *false <br> (true on debug())* | Option to overwrite log file, rather than append to it. This option is redundant if logToFile is false.  |

**logToFile** will log to *<project-root>/logs* unless [configured](#configuration) differently during instantiation. <br>
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
| `logToFileByDefault` | **Boolean** | *false* | Option to change default setting for `logToFile` parameter of logging functions. |
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
