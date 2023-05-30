import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import pkg from './package.json' assert { type: 'json' }

export default {
  input: pkg.bin,
  output: {
    file: 'dist/bundle.js',
    format: 'cjs',
  },
  external: ['lz4'],
  plugins: [resolve(), commonjs(), json()],
}
