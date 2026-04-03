/*
 * Fully custom system logging configuration
 * instantiate chronicle with additional logs, and advanced color setting
 */

import Chronicle from '../src/index.js';

const chronicle = new Chronicle({ additionalLogs: { question: 'green' }});

// create additional log with advanced direct chalk configuration
chronicle.defineType('query', chronicle.chalk().black.bgGreen);

chronicle.question('What will a fully custom chalk color function look like?');
chronicle.query('This is what a custom chalk color setting looks like');
