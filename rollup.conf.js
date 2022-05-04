const path = require('path');
const { readdirSync } = require('fs');
const { getRollupPlugins } = require('@gera2ld/plaid-rollup');
const userscript = require('rollup-plugin-userscript');
const pkg = require('./package.json');

const DIST = 'dist';
const SOURCE = 'src';

// Bundle Options
const bundleOptions = {
  extend: true,
  esModule: false,
};

// PostCSS Options
const postcssOptions = {
  ...require.resolve('@gera2ld/plaid/config/postcssrc'),
  inject: false,
  minimize: true,
};

// Looping through source files and building each userscript bundle
module.exports = readdirSync(SOURCE, { withFileTypes: true }).filter(de => de.isDirectory()).map(de => ({
  input: `${SOURCE}/${de.name}/index.js`,

  plugins: [
    ...getRollupPlugins({
      esm: true,
      minimize: false,
      postcss: postcssOptions,
    }),

    userscript(
      path.resolve(`${SOURCE}/${de.name}/meta.js`),
      meta => meta
        .replace('%name%', de.name)
        .replace('%version%', pkg.version)
        .replace('%author%', pkg.author)
        .replace('%namespace%', pkg.repository.url)
        .replace('%homepage%', `${pkg.repository.url}/tree/main/src/${de.name}`)
        .replace('%support%', `${pkg.repository.url}/issues`)
        .replace('%download%', `${pkg.repository.url}/releases/latest/download/${de.name}.user.js`),
    ),
  ],

  output: {
    format: 'iife',
    file: `${DIST}/${de.name}.user.js`,
    indent: false,
    externalLiveBindings: false,
    ...bundleOptions,
  }
}));