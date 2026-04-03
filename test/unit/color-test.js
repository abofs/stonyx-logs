import QUnit from 'qunit';
import Color from '../../src/color.js';

const { module, test } = QUnit;

module('[Unit] Color', function () {

  // --- Construction ---

  module('initialization', function () {
    test('creates instance with empty types array', function (assert) {
      const color = new Color();

      assert.ok(color instanceof Color, 'is a Color instance');
      assert.deepEqual(color.types, [], 'types starts as empty array');
    });
  });

  // --- setLogColor / getLogColor ---

  module('setLogColor and getLogColor', function () {
    test('sets and retrieves a named color', function (assert) {
      const color = new Color();
      color.setLogColor('info', 'cyan');

      const colorFn = color.getLogColor('info');
      assert.strictEqual(typeof colorFn, 'function', 'returns a function');
      assert.strictEqual(typeof colorFn('test'), 'string', 'function returns a string');
    });

    test('sets and retrieves a hex color', function (assert) {
      const color = new Color();
      color.setLogColor('custom', '#ff0000');

      const colorFn = color.getLogColor('custom');
      assert.strictEqual(typeof colorFn, 'function', 'returns a function');
      assert.strictEqual(typeof colorFn('test'), 'string', 'function returns a string');
    });

    test('sets and retrieves a chalk function', function (assert) {
      const color = new Color();
      const chalkFn = color.getChalkInstance().bold.red;
      color.setLogColor('bold-red', chalkFn);

      const colorFn = color.getLogColor('bold-red');
      assert.strictEqual(typeof colorFn, 'function', 'returns a function');
      assert.strictEqual(typeof colorFn('test'), 'string', 'function returns a string');
    });

    test('supports multiple log types simultaneously', function (assert) {
      const color = new Color();
      color.setLogColor('info', 'cyan');
      color.setLogColor('warn', 'yellow');
      color.setLogColor('error', 'red');

      const keys = Object.keys(color.types);
      assert.deepEqual(keys, ['info', 'warn', 'error'], 'all types are stored');
    });

    test('returns undefined for unset type', function (assert) {
      const color = new Color();
      const result = color.getLogColor('nonexistent');

      assert.strictEqual(result, undefined, 'returns undefined for unknown type');
    });
  });

  // --- settingToChalkColorFunction ---

  module('settingToChalkColorFunction', function () {
    test('converts named color string to function', function (assert) {
      const color = new Color();

      const fn = color.settingToChalkColorFunction('red');
      assert.strictEqual(typeof fn, 'function', 'returns a function');
      assert.strictEqual(typeof fn('test'), 'string', 'function output is a string');
    });

    test('converts hex color string to function', function (assert) {
      const color = new Color();

      const fn = color.settingToChalkColorFunction('#00ff00');
      assert.strictEqual(typeof fn, 'function', 'returns a function');
      assert.strictEqual(typeof fn('test'), 'string', 'function output is a string');
    });

    test('accepts a valid chalk function directly', function (assert) {
      const color = new Color();
      const chalk = color.getChalkInstance();
      const boldBlue = chalk.bold.blue;

      const fn = color.settingToChalkColorFunction(boldBlue);
      assert.strictEqual(typeof fn, 'function', 'returns a function');
      assert.strictEqual(fn, boldBlue, 'returns the same function');
    });

    test('handles various named colors', function (assert) {
      const color = new Color();
      const colors = ['red', 'blue', 'green', 'yellow', 'cyan', 'white', 'gray'];

      for (const name of colors) {
        const fn = color.settingToChalkColorFunction(name);
        assert.strictEqual(typeof fn, 'function', `${name} returns a function`);
        assert.strictEqual(typeof fn('x'), 'string', `${name} function returns string`);
      }
    });

    test('throws on invalid color string', function (assert) {
      const color = new Color();

      assert.throws(
        () => color.settingToChalkColorFunction('notacolor'),
        /Invalid chalk color function/,
        'throws on invalid color name',
      );
    });

    test('throws on non-string non-function setting', function (assert) {
      const color = new Color();

      assert.throws(
        () => color.settingToChalkColorFunction(42),
        /Invalid chalk color function/,
        'throws on number input',
      );

      assert.throws(
        () => color.settingToChalkColorFunction(true),
        /Invalid chalk color function/,
        'throws on boolean input',
      );

      assert.throws(
        () => color.settingToChalkColorFunction(null),
        /Invalid chalk color function/,
        'throws on null input',
      );
    });

    test('throws on function that does not return string', function (assert) {
      const color = new Color();

      assert.throws(
        () => color.settingToChalkColorFunction(() => 42),
        /Invalid chalk color function/,
        'throws when function returns non-string',
      );
    });
  });

  // --- getChalkInstance ---

  module('getChalkInstance', function () {
    test('returns chalk module', function (assert) {
      const color = new Color();
      const chalk = color.getChalkInstance();

      assert.ok(chalk, 'returns truthy value');
      assert.strictEqual(typeof chalk.red, 'function', 'has red method');
      assert.strictEqual(typeof chalk.blue, 'function', 'has blue method');
      assert.strictEqual(typeof chalk.hex, 'function', 'has hex method');
    });
  });
});
