/*
 * Fully custom system logging configuration
 * instantiate chronicle with custom options
 */

import Chronicle from '../src/index.js';

const chronicle = new Chronicle({
  logToFileByDefault: true,
  logTimestamp: true,
  path: 'custom-logs', // purposely didn't include trailing "/" to test input sanitizer
  prefix: '--------------------------------------------------------------- \n',
  suffix: '\n=============================================================== \n',
});

chronicle.info('Info: sample application has started');
chronicle.warn('Warning: this is just a sample');
chronicle.error('Error: no application logic detected');
