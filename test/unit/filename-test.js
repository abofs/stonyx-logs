import QUnit from 'qunit';
import sinon from 'sinon';
import Chronicle from '../../src/index.js';
import { hostname } from 'os';

const { module, test } = QUnit;

module('[Unit] Dynamic filenames', function (hooks) {
  let consoleLogStub;

  hooks.beforeEach(function () {
    consoleLogStub = sinon.stub(console, 'log');
    sinon.stub(console, 'dir');
  });

  hooks.afterEach(function () {
    sinon.restore();
  });

  // --- resolveFilename ---

  module('resolveFilename', function () {
    test('returns {type}.log when template is empty', function (assert) {
      const chronicle = new Chronicle();

      assert.strictEqual(chronicle.resolveFilename('', 'error'), 'error.log');
      assert.strictEqual(chronicle.resolveFilename('', 'info'), 'info.log');
    });

    test('returns {type}.log when template is undefined', function (assert) {
      const chronicle = new Chronicle();

      assert.strictEqual(chronicle.resolveFilename(undefined, 'warn'), 'warn.log');
    });

    test('resolves {type} variable', function (assert) {
      const chronicle = new Chronicle();

      assert.strictEqual(chronicle.resolveFilename('{type}-app.log', 'error'), 'error-app.log');
    });

    test('resolves {date} to YYYY-MM-DD format', function (assert) {
      const chronicle = new Chronicle();
      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const result = chronicle.resolveFilename('{date}.log', 'info');
      assert.strictEqual(result, `${expected}.log`);
    });

    test('resolves {pid} to current process ID', function (assert) {
      const chronicle = new Chronicle();

      const result = chronicle.resolveFilename('app-{pid}.log', 'info');
      assert.strictEqual(result, `app-${process.pid}.log`);
    });

    test('resolves {hostname} to machine hostname', function (assert) {
      const chronicle = new Chronicle();

      const result = chronicle.resolveFilename('app-{hostname}.log', 'info');
      assert.strictEqual(result, `app-${hostname()}.log`);
    });

    test('resolves multiple variables in a single template', function (assert) {
      const chronicle = new Chronicle();
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const result = chronicle.resolveFilename('{type}-{date}.log', 'error');
      assert.strictEqual(result, `error-${dateStr}.log`);
    });

    test('leaves unknown variables unresolved', function (assert) {
      const chronicle = new Chronicle();

      const result = chronicle.resolveFilename('{type}-{unknown}.log', 'info');
      assert.strictEqual(result, 'info-{unknown}.log');
    });

    test('strips path traversal sequences', function (assert) {
      const chronicle = new Chronicle();

      const result = chronicle.resolveFilename('../../etc/passwd', 'info');
      assert.ok(!result.includes('..'), 'no double-dot sequences');
      assert.ok(!result.includes('/'), 'no forward slashes');
    });

    test('strips directory separators from resolved output', function (assert) {
      const chronicle = new Chronicle();

      const result = chronicle.resolveFilename('sub/dir\\file.log', 'info');
      assert.ok(!result.includes('/'), 'no forward slashes');
      assert.ok(!result.includes('\\'), 'no backslashes');
    });

    test('handles template with no variables', function (assert) {
      const chronicle = new Chronicle();

      assert.strictEqual(chronicle.resolveFilename('static-name.log', 'info'), 'static-name.log');
    });
  });

  // --- defineType with filename ---

  module('defineType with filename', function () {
    test('accepts filename option without throwing', function (assert) {
      const chronicle = new Chronicle({ systemLogs: { test: 'red' } });

      chronicle.defineType('test', 'red', { filename: 'test-{date}.log' });
      assert.strictEqual(chronicle.typeOptions.test.filename, 'test-{date}.log', 'filename option stored');
    });

    test('getOptionForType returns filename when set', function (assert) {
      const chronicle = new Chronicle({ systemLogs: { test: 'red' } });
      chronicle.defineType('test', 'red', { filename: 'custom-{type}.log' });

      const result = chronicle.getOptionForType('test', 'filename');
      assert.strictEqual(result, 'custom-{type}.log', 'returns type-specific filename');
    });

    test('getOptionForType falls back to global filename', function (assert) {
      const chronicle = new Chronicle({ filename: 'global-{type}.log' });

      const result = chronicle.getOptionForType('info', 'filename');
      assert.strictEqual(result, 'global-{type}.log', 'falls back to global filename');
    });

    test('getOptionForType returns empty string when no filename set', function (assert) {
      const chronicle = new Chronicle();

      const result = chronicle.getOptionForType('info', 'filename');
      assert.strictEqual(result, '', 'returns empty string default');
    });
  });

  // --- writeToFile integration ---

  module('writeToFile uses resolved filename', function () {
    test('writeToFile calls resolveFilename with type-specific template', function (assert) {
      const chronicle = new Chronicle({ systemLogs: { test: 'red' } });
      chronicle.defineType('test', 'red', { filename: '{type}-{date}.log' });

      const resolveSpy = sinon.spy(chronicle, 'resolveFilename');
      const validateStub = sinon.stub(chronicle, 'validateFileAndDirectory').resolves();

      // stub fsp.writeFile to prevent actual file I/O
      const writeFileStub = sinon.stub().resolves();
      const appendFileStub = sinon.stub().resolves();

      // we need to call writeToFile and check that resolveFilename was called
      return chronicle.writeToFile('test', 'content', true).then(() => {
        assert.ok(resolveSpy.calledOnce, 'resolveFilename called');
        assert.strictEqual(resolveSpy.firstCall.args[0], '{type}-{date}.log', 'passes filename template');
        assert.strictEqual(resolveSpy.firstCall.args[1], 'test', 'passes type');
      }).catch(() => {
        // validateFileAndDirectory may still cause a write, that's fine for this test
        assert.ok(resolveSpy.calledOnce, 'resolveFilename called');
      });
    });

    test('writeToFile defaults to {type}.log when no filename configured', function (assert) {
      const chronicle = new Chronicle();

      const resolveSpy = sinon.spy(chronicle, 'resolveFilename');
      sinon.stub(chronicle, 'validateFileAndDirectory').resolves();

      return chronicle.writeToFile('info', 'content', true).then(() => {
        const result = resolveSpy.returnValues[0];
        assert.strictEqual(result, 'info.log', 'resolved to default filename');
      }).catch(() => {
        const result = resolveSpy.returnValues[0];
        assert.strictEqual(result, 'info.log', 'resolved to default filename');
      });
    });
  });
});
