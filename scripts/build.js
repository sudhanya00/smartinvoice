/**
 * Production build wrapper.
 *
 * Create React App copies EVERY environment variable whose name starts with
 * REACT_APP_ into the browser bundle, whether or not the code reads it. A
 * secret stored under such a name is therefore public the moment the site
 * is deployed.
 *
 * This wrapper blanks the names listed below before the client build runs,
 * so a server-only secret cannot ship even if the hosting environment still
 * has it set. The serverless function (api/gemini.js) reads its environment
 * at request time and is not affected.
 */
const SERVER_ONLY = ['REACT_APP_GEMINI_API_KEY'];

for (const name of SERVER_ONLY) {
    if (process.env[name]) {
        console.warn(
            `[build] ${name} is set. It is kept out of the browser bundle; ` +
            'rename it to GEMINI_API_KEY in your hosting settings.'
        );
    }
    // Set to empty rather than delete, so a value in a local .env file
    // is not loaded in its place.
    process.env[name] = '';
}

require('react-scripts/scripts/build');
