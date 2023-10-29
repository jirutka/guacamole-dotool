// @ts-check
import * as FS from 'node:fs'

import cleanup from 'rollup-plugin-cleanup'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import license from 'rollup-plugin-license'
import MagicString from 'magic-string'
import natives from 'rollup-plugin-natives'
import replace from '@rollup/plugin-replace'
import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'

const licenseBanner = `
Name: <%= pkg.name %>
Version: <%= pkg.version %>
Author: <%= pkg.author.name %> <<%= pkg.author.email %>>
License: <%= pkg.license %> AND <%=
  _.without(_.uniq(dependencies.map(dep => dep.license.replaceAll(' ', '-'))), pkg.license).join(' AND ')
%>
Homepage: <%= pkg.homepage %>
Generated: <%= moment().format('YYYY-MM-DD') %>

Bundled dependencies:
<% for (const dep of _.sortBy(dependencies, 'name')) { %>- <%= dep.name %>@<%= dep.version %> (<%= dep.license %>)
<% } %>
`

/** @return {import('rollup').Plugin} */
const executable = () => ({
  name: 'executable',
  // NOTE: Simple `output.banner` doesn't work, it's written *after* the
  // license plugin.
  renderChunk(code, _, opts) {
    const magic = new MagicString(code)
    magic.prepend('#!/usr/bin/env node\n')
    return {
      code: magic.toString(),
      map: opts.sourcemap !== false ? magic.generateMap() : null,
    }
  },
  writeBundle(opts, bundle) {
    for (const info of Object.values(bundle)) {
      if (info.type === 'chunk') {
        FS.chmodSync(`${opts.dir}/${info.fileName}`, 0o755)
      }
    }
  },
})

/** @type {import('rollup').RollupOptions} */
const config = {
  input: './src/cli.ts',
  plugins: [
    // Resolve node modules.
    resolve({
      preferBuiltins: true,
    }),
    // Remove `require.resolve("./xhr-sync-worker.js")` from jsdom.
    replace({
      include: 'node_modules/jsdom/**/*.js',
      preventAssignment: false,
      values: {
        'require.resolve': 'undefined',
      },
    }),
    // Convert .json files to ES6 modules.
    json({
      compact: true,
    }),
    // Transpile TypeScript sources to JS.
    typescript({
      declaration: false,
      outDir: undefined,
    }),
    // Convert CommonJS modules to ES6 modules.
    commonjs({
      extensions: ['.js', '.ts'],
      // The default option (false) breaks `canvas.node`.
      requireReturnsDefault: 'auto',
    }),
    // Extract native modules (*.node files).
    // @ts-ignore
    natives({
      copyTo: './dist/libs',
      destDir: './libs',
      targetEsm: true,
    }),
    // Strip comments etc.
    cleanup({
      comments: 'none',
    }),
    // Generate license banner and prepend it to the bundle.
    license({
      banner: {
        commentStyle: 'ignored',
        content: licenseBanner,
      },
    }),
    // Add shebang and set the executable bit.
    executable(),
  ],
  output: {
    dir: './dist',
    entryFileNames: 'guacamole-dotool.mjs',
    format: 'es',
    sourcemap: true,
  },
}

export default config
