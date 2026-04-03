/*
 * Default settings (Out of the box)
 * Instantiate chronicle with default settings
 */

import Chronicle from '../src/index.js';

const chronicle = new Chronicle();

chronicle.info('Info: sample application has started');
chronicle.warn('Warning: this is just a sample');
chronicle.error('Error: no application logic detected', true); // passes true in order to log to logs/error.log file
chronicle.debug({
  foo: 'bar',
  x: 6,
}, true);
