import QUnit from 'qunit';
import sinon from 'sinon';
import Chronicle from '../../src/index.js';

const { module, test } = QUnit;

module('[Unit] Chronicle', function (hooks) {
  let consoleLogStub;
  let consoleDirStub;

  hooks.beforeEach(function () {
    consoleLogStub = sinon.stub(console, 'log');
    consoleDirStub = sinon.stub(console, 'dir');
  });

  hooks.afterEach(function () {
    sinon.restore();
  });

  // --- Initialization ---

  module('initialization', function () {
    test('creates instance with default options', function (assert) {
      const chronicle = new Chronicle();

      assert.ok(chronicle instanceof Chronicle, 'is a Chronicle instance');
      assert.strictEqual(chronicle.options.logToFileByDefault, false, 'logToFileByDefault defaults to false');
      assert.strictEqual(chronicle.options.logTimestamp, false, 'logTimestamp defaults to false');
      assert.strictEqual(chronicle.options.prefix, '', 'prefix defaults to empty string');
      assert.strictEqual(chronicle.options.suffix, '', 'suffix defaults to empty string');
    });

    test('creates default system log methods (info, warn, error)', function (assert) {
      const chronicle = new Chronicle();

      assert.strictEqual(typeof chronicle.info, 'function', 'info method exists');
      assert.strictEqual(typeof chronicle.warn, 'function', 'warn method exists');
      assert.strictEqual(typeof chronicle.error, 'function', 'error method exists');
    });

    test('creates debug method', function (assert) {
      const chronicle = new Chronicle();

      assert.strictEqual(typeof chronicle.debug, 'function', 'debug method exists');
    });

    test('merges user options with defaults', function (assert) {
      const chronicle = new Chronicle({
        logTimestamp: true,
        prefix: '[APP] ',
      });

      assert.strictEqual(chronicle.options.logTimestamp, true, 'logTimestamp overridden');
      assert.strictEqual(chronicle.options.prefix, '[APP] ', 'prefix overridden');
      assert.strictEqual(chronicle.options.logToFileByDefault, false, 'logToFileByDefault retains default');
    });

    test('creates convenience methods for custom systemLogs', function (assert) {
      const chronicle = new Chronicle({
        systemLogs: {
          success: 'green',
          trace: 'gray',
        },
      });

      assert.strictEqual(typeof chronicle.success, 'function', 'success method created');
      assert.strictEqual(typeof chronicle.trace, 'function', 'trace method created');
      assert.strictEqual(chronicle.info, undefined, 'default info not created when systemLogs overridden');
    });

    test('creates convenience methods for additionalLogs merged with systemLogs', function (assert) {
      const chronicle = new Chronicle({
        additionalLogs: {
          custom: 'green',
        },
      });

      assert.strictEqual(typeof chronicle.custom, 'function', 'custom method created');
      assert.strictEqual(typeof chronicle.info, 'function', 'info still exists from default systemLogs');
      assert.strictEqual(typeof chronicle.warn, 'function', 'warn still exists from default systemLogs');
      assert.strictEqual(typeof chronicle.error, 'function', 'error still exists from default systemLogs');
    });

    test('sanitizes path to include trailing slash', function (assert) {
      const chronicle = new Chronicle({ path: 'test-output' });

      assert.ok(chronicle.options.path.endsWith('/'), 'path ends with /');
    });
  });

  // --- Log methods ---

  module('log methods', function () {
    test('info logs to console', function (assert) {
      const chronicle = new Chronicle();
      chronicle.info('hello world');

      assert.ok(consoleLogStub.calledOnce, 'console.log called once');
      const loggedMessage = consoleLogStub.firstCall.args[0];
      assert.ok(loggedMessage.includes('hello world'), 'message content is logged');
    });

    test('warn logs to console', function (assert) {
      const chronicle = new Chronicle();
      chronicle.warn('be careful');

      assert.ok(consoleLogStub.calledOnce, 'console.log called once');
      const loggedMessage = consoleLogStub.firstCall.args[0];
      assert.ok(loggedMessage.includes('be careful'), 'message content is logged');
    });

    test('error logs to console', function (assert) {
      const chronicle = new Chronicle();
      chronicle.error('something broke');

      assert.ok(consoleLogStub.calledOnce, 'console.log called once');
      const loggedMessage = consoleLogStub.firstCall.args[0];
      assert.ok(loggedMessage.includes('something broke'), 'message content is logged');
    });

    test('debug uses console.dir with depth 6', function (assert) {
      const chronicle = new Chronicle();
      const data = { foo: 'bar' };
      chronicle.debug(data);

      assert.ok(consoleDirStub.calledOnce, 'console.dir called once');
      assert.deepEqual(consoleDirStub.firstCall.args[0], data, 'passes content to console.dir');
      assert.deepEqual(consoleDirStub.firstCall.args[1], { depth: 6 }, 'uses depth 6');
    });

    test('log does not write to file when logToFile is false', function (assert) {
      const chronicle = new Chronicle();
      const writeStub = sinon.stub(chronicle, 'writeToFile');
      chronicle.info('no file');

      assert.ok(writeStub.notCalled, 'writeToFile not called');
    });

    test('log includes prefix when configured', function (assert) {
      const chronicle = new Chronicle({ prefix: '[PREFIX] ' });
      chronicle.info('test message');

      const loggedMessage = consoleLogStub.firstCall.args[0];
      assert.ok(loggedMessage.includes('[PREFIX]'), 'prefix appears in output');
      assert.ok(loggedMessage.includes('test message'), 'message appears in output');
    });

    test('log includes suffix when configured', function (assert) {
      const chronicle = new Chronicle({ suffix: ' [END]' });
      chronicle.info('test message');

      const loggedMessage = consoleLogStub.firstCall.args[0];
      assert.ok(loggedMessage.includes('[END]'), 'suffix appears in output');
    });
  });

  // --- defineType ---

  module('defineType', function () {
    test('creates a new convenience method', function (assert) {
      const chronicle = new Chronicle({ systemLogs: {} });
      assert.strictEqual(chronicle.custom, undefined, 'custom method does not exist initially');

      chronicle.defineType('custom', 'green');
      assert.strictEqual(typeof chronicle.custom, 'function', 'custom method created');
    });

    test('does not overwrite existing convenience method', function (assert) {
      const chronicle = new Chronicle({ systemLogs: { test: 'red' } });
      const originalMethod = chronicle.test;

      chronicle.defineType('test', 'blue');
      assert.strictEqual(chronicle.test, originalMethod, 'method reference unchanged');
    });

    test('stores type-specific options', function (assert) {
      const chronicle = new Chronicle({ systemLogs: { test: 'red' } });
      chronicle.defineType('test', 'red', {
        logToFileByDefault: true,
        prefix: '>> ',
      });

      assert.strictEqual(chronicle.typeOptions.test.logToFileByDefault, true, 'type option stored');
      assert.strictEqual(chronicle.typeOptions.test.prefix, '>> ', 'type prefix stored');
    });

    test('throws on non-object options param', function (assert) {
      const chronicle = new Chronicle({ systemLogs: { test: 'red' } });

      assert.throws(
        () => chronicle.defineType('test', 'red', 'bad'),
        /The options param must be an object/,
        'throws descriptive error',
      );
    });

    test('throws on invalid option keys', function (assert) {
      const chronicle = new Chronicle({ systemLogs: { test: 'red' } });

      assert.throws(
        () => chronicle.defineType('test', 'red', { invalidOption: true }),
        /invalidOption is not a valid configuration object/,
        'throws with invalid option name',
      );
    });
  });

  // --- getOptionForType ---

  module('getOptionForType', function () {
    test('returns global option when no type-specific option set', function (assert) {
      const chronicle = new Chronicle({ prefix: '[GLOBAL] ' });

      const result = chronicle.getOptionForType('info', 'prefix');
      assert.strictEqual(result, '[GLOBAL] ', 'falls back to global option');
    });

    test('returns type-specific option when set', function (assert) {
      const chronicle = new Chronicle({ systemLogs: { test: 'red' } });
      chronicle.defineType('test', 'red', { prefix: '[TYPE] ' });

      const result = chronicle.getOptionForType('test', 'prefix');
      assert.strictEqual(result, '[TYPE] ', 'uses type-specific option');
    });
  });

  // --- chalk ---

  module('chalk', function () {
    test('returns chalk instance', function (assert) {
      const chronicle = new Chronicle();
      const chalkInstance = chronicle.chalk();

      assert.ok(chalkInstance, 'chalk instance returned');
      assert.strictEqual(typeof chalkInstance.red, 'function', 'chalk has color methods');
    });
  });
});
