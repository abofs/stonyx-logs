import Qunit from 'qunit';
import { promises as fsp } from 'fs';
import Log from '../src/index.js';

const { module, test } = Qunit;

function removeDirectory(path, assert) {
  return fsp.rm(path, {
    recursive: true,
    force: true,
  }).catch(() => {
    assert.throws(() => {
      throw new Error('Failed to remove log directory');
    });
  });
}

async function targetExists(target) {
  let targetExists;
  await fsp.access(target).then(() => targetExists = true).catch(() => targetExists = false);

  return targetExists;
}

module('[Integration] Log Tests', () => {
  test('Convenience methods for systemLogs are successfully created', assert => {
    const log = new Log({
      systemLogs: {
        a: 'white',
        b: 'blue',
        c: 'red',
      },
    });
    const { a, b, c, info, warn, error } = log;

    assert.deepEqual(
      [typeof a, typeof b, typeof c, info, warn, error],
      ['function', 'function', 'function', undefined, undefined, undefined],
      'systemLogs functions were replaced by configuration',
    );
  });

  test('Convenience methods for additionalLogs are successfully created', assert => {
    const log = new Log({
      additionalLogs: {
        a: 'white',
        b: 'blue',
        error: 'red',
      },
    });
    const { a, b, info, warn, error } = log;

    assert.deepEqual(
      [typeof a, typeof b, typeof info, typeof warn, typeof error],
      ['function', 'function', 'function', 'function', 'function'],
      'additionalLogs functions were merged with systemLogs',
    );
  });

  test('Debug method is successfully created', assert => {
    const log = new Log();

    assert.equal(typeof log.debug, 'function', 'debug method exists');
  });

  test('Log creation respects the default logToFileByDefault as false', async assert => {
    const log = new Log({ systemLogs: { test: 'green' }});
    const { path } = log.options;

    let logDirExists = await targetExists(path);

    // clean up log directory before test if it exists
    if (logDirExists) {
      await removeDirectory(path, assert);
    }

    await log.test('log test');
    logDirExists = await targetExists(path);

    assert.notOk(logDirExists, 'Log directory does not exist');

    await log.test('log to file test', true);
    logDirExists = await targetExists(path);
    const logFileExists = await targetExists(`${path}test.log`);

    assert.ok(logDirExists, 'log directory exists');
    assert.ok(logFileExists, 'log file exists');

    await removeDirectory(path, assert); // clean up to prevent test pollution
  });

  test('Log creation respects the configured logToFileByDefault setting as true', async assert => {
    const log = new Log({
      logToFileByDefault: true,
      systemLogs: { test: 'green' },
    });
    const { path } = log.options;

    let logDirExists = await targetExists(path);

    // clean up log directory before test if it exists
    if (logDirExists) {
      await removeDirectory(path, assert);
    }

    await log.test('log to file test');
    logDirExists = await targetExists(path);
    const logFileExists = await targetExists(`${path}test.log`);

    assert.ok(logDirExists, 'log directory exists');
    assert.ok(logFileExists, 'log file exists');

    await removeDirectory(path, assert); // cleanup directory

    await log.test('log to file test', false);
    logDirExists = await targetExists(path);

    assert.notOk(logDirExists, 'log directory does not exists');
  });

  test('Log creation respects the configured path setting', async assert => {
    const log = new Log({
      path: 'test-logs',
      systemLogs: { test: 'green' },
    });
    const { path } = log.options;

    assert.ok(path.includes('test-logs'), 'configured directory is correct');

    await log.test('log to file test', true);
    const logDirExists = await targetExists(path);
    const logFileExists = await targetExists(`${path}test.log`);

    assert.ok(logDirExists, 'log directory exists');
    assert.ok(logFileExists, 'log file exists');

    await removeDirectory(path, assert); // clean up directory
  });

  test('Log creation respects type specific options set via defineType', async assert => {
    const log = new Log({ systemLogs: { foo: 'green' }});
    const { path } = log.options;
    log.defineType('bar', 'yellow', {
      logToFileByDefault: true,
      logTimestamp: true,
      path: 'test-logs',
      prefix: '--------------------------------------------------------------- \n',
      suffix: '\n=============================================================== \n',
    });
    const barPath = log.typeOptions.bar.path;

    await log.foo('log with no prefix and suffix, and do not create logs');
    let logDirExists = await targetExists(path);
    let barLogDirExists = await targetExists(barPath);

    assert.notOk(logDirExists, 'log directory does not exist');
    assert.notOk(barLogDirExists, 'defineType log directory does not exist');

    await log.bar('log with timestamp, prefix, suffix, and create custom logs');
    logDirExists = await targetExists(path);
    barLogDirExists = await targetExists(barPath);
    const logFileExists = await targetExists(`${barPath}bar.log`);

    assert.notOk(logDirExists, 'log directory does not exist');
    assert.ok(barLogDirExists, 'defineType log directory exists');
    assert.ok(logFileExists, 'bar log file exists');

    await removeDirectory(barPath, assert); // clean up directory
  });

  test('App crashes with descriptive error if user passes a non-object param to for options', async assert => {
    assert.expect(1); // expect assertion to happen in catch block
    const log = new Log({ systemLogs: { test: 'green' }});

    try {
      log.defineType('test', 'yellow', true);
    } catch (error) {
      assert.equal(error, 'The options param must be an object.');
    }
  });

  test('App crashes with descriptive error when user uses defineType with bad options', async assert => {
    assert.expect(2); // expect assertions to happen in catch block
    const log = new Log({ systemLogs: { test: 'green' }});

    try {
      log.defineType('test', 'yellow', {
        invalidOption1: true,
        invalidOption2: true,
      });
    } catch (error) {
      assert.ok(error.includes('invalidOption1'), 'Error message includes invalidOption1');
      assert.notOk(error.includes('invalidOption2'), 'Error message does not include invalidOption2');
    }
  });
});
