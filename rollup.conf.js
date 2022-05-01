const path = require('path');
const { readdir, readdirSync } = require('fs');
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
        .replace('process.env.VERSION', pkg.version)
        .replace('process.env.AUTHOR', pkg.author)
        .replace('%durl%', `https://raw.githubusercontent.com/quantix-dev/userscripts/main/dist/${de.name}.user.js`)
        .replace('%hurl%', `https://github.com/quantix-dev/userscripts/tree/main/src/${de.name}`),
    ),
  ],

  output: {
    indent: false,
    externalLiveBindings: false,
    format: 'iife',
    file: `${DIST}/${de.name}.user.js`,
    ...bundleOptions,
  }
}));