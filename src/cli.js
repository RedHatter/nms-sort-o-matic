import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises'
import sade from 'sade'
import pkg from '../package.json' assert { type: 'json' }
import {
  readSaveFile,
  encodeSaveFile,
  sortSaveFile,
  downloadItems,
  downloadMappings,
  getInventoryItems,
} from './main.js'
import _ from 'lodash'

async function writeJson(opts, data, skipBackup) {
  if (opts.in === opts.out) {
    if (skipBackup) {
      console.log('Detected already edited save file. Skipping backup.')
    } else {
      await copyFile(opts.out, opts.out + '.bk')
    }
  }

  await writeFile(opts.out, JSON.stringify(data))
}

sade(pkg.name, true)
  .version(pkg.version)
  .describe(pkg.description)
  .option('-i, --in', 'The save file to process', 'save.hg')
  .option('-o, --out', 'The file to write the results to')
  .option('-u, --update', 'Download the configuration files then exit')
  .option('-d, --decode', 'Decript and decode save file then exit')
  .option('-e, --encode', 'Encode save file then exit')
  .option('-p, --print', 'Print inventory items then exit')
  .action(async (opts) => {
    opts.out ??= opts.in

    try {
      await mkdir('tmp')
    } catch (e) {
      if (e.code !== 'EEXIST') {
        console.error(e)
      }
    }

    if (opts.update) {
      await Promise.all([downloadItems(), downloadMappings()])
      process.exit(0)
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

    if (opts.print) {
      const data = await readSaveFile(opts.in)
      const inventoryItems = await getInventoryItems(data)

      const cols = _.chain(inventoryItems)
        .flatMap()
        .compact()
        .reduce(
          (cols, item) => ({
            ...cols,
            ..._.mapValues(item, (value, key) =>
              Math.max(String(value).length, cols[key] ?? 0)
            ),
          }),
          {}
        )
        .value()

      const res = _.chain(inventoryItems)
        .flatMap((value, key) =>
          !value || value.length < 1
            ? []
            : [
                key,
                ''.padEnd(key.length, '-'),
                ...value.map((item) =>
                  [
                    _.capitalize(item.name).padEnd(cols.name),
                    item.id.padEnd(cols.id),
                    String(item.amount).padEnd(cols.amount),
                    item.category?.padEnd(cols.category),
                  ].join('\t')
                ),
                '\n',
              ]
        )
        .join('\n')
        .value()
      console.log(res)
      process.exit(0)
    }

    const data = await readSaveFile(opts.in)
    const skipBackup = data.__sorted
    const sorted = await sortSaveFile(data)
    const raw = await encodeSaveFile(sorted)

    await writeJson(opts, raw, skipBackup)
  })
  .parse(process.argv)
