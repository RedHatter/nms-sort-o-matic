import { mkdir, writeFile, copyFile } from 'node:fs/promises'
import sade from 'sade'
import pkg from '../package.json' assert { type: 'json' }
import { readSaveFile, encodeSaveFile, sortSaveFile } from './main.js'

async function writeJson(opts, data) {
  if (opts.in === opts.out) {
    if (data.__sorted) {
      console.log('Detected already edited save file. Skipping backup.')
    } else {
      await copyFile(filepath, filepath + '.bk')
    }
  }

  await writeFile(opts.out, JSON.stringify(data))
}

sade(pkg.name, true)
  .version(pkg.version)
  .describe(pkg.description)
  .option('-i, --in', 'The save file to process', 'save.hg')
  .option('-o, --out', 'The file to write the results to')
  .option('-d, --decode', 'Decript and decode save file then exit')
  .option('-e, --encode', 'Encode save file then exit')
  .action(async (opts) => {
    opts.out ??= opts.in

    try {
      await mkdir('tmp')
    } catch (e) {
      if (e.code !== 'EEXIST') {
        console.error(e)
      }
    }

    if (opts.decode) {
      const data = await readSaveFile(opts.in)
      await writeJson(opts, data)
      process.exit(0)
    }

    if (opts.encode) {
      const data = JSON.parse(await readFile(opts.in))
      const raw = await encodeSaveFile(data)
      await writeJson(opts, raw)
      process.exit(0)
    }

    const data = await readSaveFile(opts.in)
    const sorted = await sortSaveFile(data)
    const raw = await encodeSaveFile(sorted)
    await writeJson(opts, raw)
  })
  .parse(process.argv)
