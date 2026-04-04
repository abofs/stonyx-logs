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

**Chronicle** is built on top of all the great work done by "Sindre Sorhus" and other collaborators of the [chalk](https://www.npmjs.com/package/chalk) project.
This project is not directly associated with chalk other than chalk being a core dependency of **Chronicle**.

**IMPORTANT**: Please note that although **Chronicle** can be configured to any color through chalk, your output is subject to your terminal's color limitations.

## Highlights

- Fully configurable
- Simple and Expressive API
- Highly performant

## Install

```sh
npm install node-chronicle
```

## Usage

```js
import Chronicle from 'node-chronicle';

const chronicle = new Chronicle();

chronicle.info('Info: sample application has started');
chronicle.warn('Warning: this is just a sample');
chronicle.error('Error: no application logic detected', true); // logs to logs/error.log file
```

Easily define your own logging mechanism and color-coding preference:

```js
import Chronicle from 'node-chronicle';

const chronicle = new Chronicle({
  systemLogs: {
    blue: '#007cae', // indigo blue
    yellow: '#ae8f00', // bright orange
    red: 'red',
  },
});

chronicle.blue('Info: using custom method blue, sample application has started');
chronicle.yellow('Warning: using custom method yellow, this is just a sample');
chronicle.red('Error: using custom method red, no application logic detected', false);
```

Customize logging options to best suit your project

```js
import Chronicle from 'node-chronicle';

const chronicle = new Chronicle({
  logToFileByDefault: true,
  logTimestamp: true,
  path: 'custom-logs', // <project root>/custom-logs/*.log
  prefix: '--------------------------------------------------------------- \n',
  suffix: '\n=============================================================== \n',
});

chronicle.info('Info: sample application has started');
```
![](https://github.com/abofs/stonyx-logs/raw/main/media/examples/custom-options.jpg)


Add additional log types extending the default options of "info", "warn", "error" and "debug"

```js
import Chronicle from '../source/index.js';

const chronicle = new Chronicle({ additionalLogs: { question: 'green' } });

// create additional log with direct chalk configuration
chronicle.defineType('query', chronicle.chalk().black.bgGreen);

chronicle.question('What will a fully custom chalk color function look like?');
await chronicle.query('This is what a custom chalk color setting looks like', true);
```
![](https://github.com/abofs/stonyx-logs/raw/main/media/examples/additional-logs.jpg)

## API

### Defining Logs & Colors

By default, **Chronicle** is instantiated with the following options:

```js
  additionalLogs: {},
  systemLogs: {
    info: 'cyan',
    warn: 'yellow',
    error: 'red',
  },
```

You can add to a new log/color setting by passing the `additionalLogs` option to the **Chronicle** constructor. Any setting that already exists in `systemLogs` will be replaced, otherwise they will be added.
 
```js
  const chronicle = new Chronicle({ additionalLogs: { info: 'green', custom: 'cyan' } });

  // output configuration:
  {
    info: 'green',
    warn: 'yellow',
    error: 'red',
    custom: 'cyan'
  }
```

**Chronicle** will generate convenience methods for all keys provided, with the corresponding color settings. The example above would create the following convenience methods, for logging:

```js
  chronicle.info() // green output
  chronicle.warn() // yellow output
  chronicle.error() // red output
  chronicle.custom() // cyan output
```

These methods can then be called in your application with [logging parameters](#logging-parameters).

Color settings are handled by determining whether your input is a color name or a hex value (prefixed with **#**). For example, passing `red` as a color setting will utilize `chalk.red`, while passing `#ff0000` would use `chalk.hex('#ff0000')` instead. A [list of available colors](https://github.com/chalk/chalk#colors) can be found in chalks' documentation.

Additionally, these methods return a promise when `logToFile` is true, allowing you use them with `await` in an async method, or append `then(), catch(), or finally()` for more advanced callback usage.

```js
async method() {
  await chronicle.error('error message', true);

  // do something after logs/error.log (default) is created
}
```

### The Debug Method

**Chronicle** allows for the `chronicle.debug()` method to be overridden by a color setting. However, by default we do not define a color for debug and debug is handled differently. For console logging, all **debug** does is output the following:

```js
// For logging to console:
console.dir(content);

// For writing to file:
JSON.stringify(content, null, 2);
```

We believe that when wanting to output complicated objects or debug **typescript** applications, there are better methods than utilizing this **Chronicle** package. But for anyone who's fully incorporated **Chronicle** into their project, this function offers some convenience.

### Logging Parameters

```js
chronicle.error('error message', true, false); // content, logToFile, overwrite
```

| Parameter | Type | Default | Description |
| :---: | :---: | :---: | :--- |
| `content` | **String** | | Content of log that will output on your console. |
| `logToFile` | **Boolean** | *false* | Option to log content to file. |
| `overwrite` | **Boolean** | *false <br> (true on debug())* | Option to overwrite log file, rather than append to it. This option is redundant if logToFile is false.  |

**logToFile** will log to *<project-root>/logs* unless [configured](#configuration) differently during instantiation. <br>
### Configuration

When instantiating **Chronicle**, you can pass an object to customize your settings. Below is the default configuration:

```js
const chronicle = new Chronicle({
  logToFileByDefault: false,
  logTimestamp: false,
  path: 'logs/',
  prefix: '',
  suffix: '',
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
| `additionalLogs` | **Object** | | Key value pair object containing log type to color setting for logs that will be merged with `systemLogs` |
| `systemLogs` | **Object** | | Key value pair object containing log type to color setting for main **Chronicle** logs available in application |

`additionalLogs` and `systemLogs` are explained with more detail in the [defining logs and colors](#defining-logs) section.

### Advanced Configuration

You may want to do more than just pick a basic color for your output. **chalk** offers a variety of different options, and can be configured via `defineType()`. **Chronicle** exposes the chalk instance via `chalk()` so that you don't have to import **chalk** directly into your project. Here is an example of how you can use this method to fully customize your log color setting:

```js
const chronicle = new Chronicle();

chronicle.defineType('critical', chronicle.chalk().bold.red);
chronicle.critical('This is a critical error');
```

Additionally, any [configuration](#configuration) that can be set during instantiation, can also be applied exclusively to any given type by passing in a third **options** parameter.

```js
// params: type, setting, options
chronicle.definetype('notice', '#c0c0c0', {
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
const chronicle = new Chronicle();

chronicle.defineType('info', chronicle.chalk().black.bgCyan);
chronicle.defineType('critical', chronicle.chalk().bold.red);
chronicle.defineType('dialog', 'magentaBright');
chronicle.definetype('notice', '#c0c0c0', {
  prefix: '--------------------------------------------------------------- \n',
  suffix: '\n=============================================================== \n'
});

chronicle.info('This pre-existing log now has a cyan background and black foreground');
chronicle.critical('This new log is bold and red');
chronicle.dialog('This new dialog is bright magenta');
chronicle.notice('This new log is the hex "#c0c0c0" share of gray');
```

`defineType()` can also be used as an alternative to populating the `additionalLogs` setting in the constructor, as if the setting doesn't already exist, it will then be created.

## Origin

As a team of developers who are constantly working on side projects, we often litter our codebase with TODOs to refactor convenience utils such as **chronicle** into classes of their own, or projects of their own. This usually turns into internal tech debt that never gets addressed. Furthermore, we also often find ourselves going the *copy -> paste -> modify* route of previously written useful logic, which saves us time in new projects, but not as much as it would if all we had to do was run an `npm install` instead. 

With that in mind, we are proud to release **chronicle** as an open source package, in hopes others will find this just as useful as we do in their own projects.  

## Maintainers

- [Stone Costa](https://github.com/mstonepc)
- [Daniel DeLima](https://github.com/danieldtech)
