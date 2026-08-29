import QUnit from 'qunit';
import sinon from 'sinon';
import fs from 'fs';
import Log from '../../src/index.js';
import { hostname } from 'os';

const { module, test } = QUnit;

module('[Unit] Dynamic filenames', function (hooks) {

  hooks.beforeEach(function () {
    sinon.stub(console, 'log');
    sinon.stub(console, 'dir');
  });

  hooks.afterEach(function () {
    sinon.restore();
  });

  // --- resolveFilename ---

  module('resolveFilename', function () {
    test('returns {type}.log when template is empty', function (assert) {
      const log = new Log();

      assert.strictEqual(log.resolveFilename('', 'error'), 'error.log');
      assert.strictEqual(log.resolveFilename('', 'info'), 'info.log');
    });

    test('returns {type}.log when template is undefined', function (assert) {
      const log = new Log();

      assert.strictEqual(log.resolveFilename(undefined as unknown as string, 'warn'), 'warn.log');
    });

    test('resolves {type} variable', function (assert) {
      const log = new Log();

      assert.strictEqual(log.resolveFilename('{type}-app.log', 'error'), 'error-app.log');
    });

    test('resolves {date} to YYYY-MM-DD format', function (assert) {
      const log = new Log();
      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const result = log.resolveFilename('{date}.log', 'info');
      assert.strictEqual(result, `${expected}.log`);
    });

    test('resolves {pid} to current process ID', function (assert) {
      const log = new Log();

      const result = log.resolveFilename('app-{pid}.log', 'info');
      assert.strictEqual(result, `app-${process.pid}.log`);
    });

    test('resolves {hostname} to machine hostname', function (assert) {
      const log = new Log();

      const result = log.resolveFilename('app-{hostname}.log', 'info');
      assert.strictEqual(result, `app-${hostname()}.log`);
    });

    test('resolves multiple variables in a single template', function (assert) {
      const log = new Log();
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const result = log.resolveFilename('{type}-{date}.log', 'error');
      assert.strictEqual(result, `error-${dateStr}.log`);
    });

    test('leaves unknown variables unresolved', function (assert) {
      const log = new Log();

      const result = log.resolveFilename('{type}-{unknown}.log', 'info');
      assert.strictEqual(result, 'info-{unknown}.log');
    });

    test('strips path traversal sequences', function (assert) {
      const log = new Log();

      const result = log.resolveFilename('../../etc/passwd', 'info');
      assert.ok(!result.includes('..'), 'no double-dot sequences');
      assert.ok(!result.includes('/'), 'no forward slashes');
    });

    test('strips directory separators from resolved output', function (assert) {
      const log = new Log();

      const result = log.resolveFilename('sub/dir\\file.log', 'info');
      assert.ok(!result.includes('/'), 'no forward slashes');
      assert.ok(!result.includes('\\'), 'no backslashes');
    });

    test('handles template with no variables', function (assert) {
      const log = new Log();

      assert.strictEqual(log.resolveFilename('static-name.log', 'info'), 'static-name.log');
    });
  });

  // --- defineType with filename ---

  module('defineType with filename', function () {
    test('accepts filename option without throwing', function (assert) {
      const log = new Log({ systemLogs: { test: 'red' } });

      log.defineType('test', 'red', { filename: 'test-{date}.log' });
      assert.strictEqual(log.typeOptions.test.filename, 'test-{date}.log', 'filename option stored');
    });

    test('getOptionForType returns filename when set', function (assert) {
      const log = new Log({ systemLogs: { test: 'red' } });
      log.defineType('test', 'red', { filename: 'custom-{type}.log' });

      const result = log.getOptionForType('test', 'filename');
      assert.strictEqual(result, 'custom-{type}.log', 'returns type-specific filename');
    });

    test('getOptionForType falls back to global filename', function (assert) {
      const log = new Log({ filename: 'global-{type}.log' });

      const result = log.getOptionForType('info', 'filename');
      assert.strictEqual(result, 'global-{type}.log', 'falls back to global filename');
    });

    test('getOptionForType returns empty string when no filename set', function (assert) {
      const log = new Log();

      const result = log.getOptionForType('info', 'filename');
      assert.strictEqual(result, '', 'returns empty string default');
    });
  });

  // --- writeToFile integration ---

  module('writeToFile uses resolved filename', function () {
    test('writeToFile calls resolveFilename with type-specific template', async function (assert) {
      const log = new Log({ systemLogs: { test: 'red' } });
      log.defineType('test', 'red', { filename: '{type}-{date}.log' });

      const resolveSpy = sinon.spy(log, 'resolveFilename');
      sinon.stub(log, 'validateFileAndDirectory').resolves();

      // stubbed so the unit test never writes into the real log directory
      const writeStub = sinon.stub(fs.promises, 'writeFile').resolves();

      await log.writeToFile('test', 'content', true);

      assert.ok(resolveSpy.calledOnce, 'resolveFilename called');
      assert.strictEqual(resolveSpy.firstCall.args[0], '{type}-{date}.log', 'passes filename template');
      assert.strictEqual(resolveSpy.firstCall.args[1], 'test', 'passes type');
      assert.ok(writeStub.calledOnce, 'payload write issued against the resolved target');
    });

    test('writeToFile defaults to {type}.log when no filename configured', async function (assert) {
      const log = new Log();

      const resolveSpy = sinon.spy(log, 'resolveFilename');
      sinon.stub(log, 'validateFileAndDirectory').resolves();

      // stubbed so the unit test never writes into the real log directory
      const writeStub = sinon.stub(fs.promises, 'writeFile').resolves();

      await log.writeToFile('info', 'content', true);

      assert.strictEqual(resolveSpy.returnValues[0], 'info.log', 'resolved to default filename');
      assert.strictEqual(writeStub.firstCall.args[0], `${log.options.path}info.log`, 'wrote to the default target');
    });
  });
});
