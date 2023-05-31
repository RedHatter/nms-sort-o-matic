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

async function writeJson(outFile, inFile, data, skipBackup) {
  if (outFile === inFile) {
    if (skipBackup) {
      console.log('Detected already edited save file. Skipping backup.')
    } else {
      await copyFile(inFile, inFile + '.bk')
    }
  }

  await writeFile(outFile, JSON.stringify(data))
}

async function ensureTemporaryDirectory() {
  try {
    await mkdir('tmp')
  } catch (e) {
    if (e.code !== 'EEXIST') {
      console.error(e)
    }
  }
}

sade(pkg.name)
  .version(pkg.version)
  .describe(pkg.description)
  .command('sort <save-file>', 'Sort the inventory', { default: true })
  .option(
    '-o, --out',
    'The file to write the results to. Defaults to <save-file>'
  )
  .action(async (inFile, opts) => {
    opts.out ??= inFile

    await ensureTemporaryDirectory()
    const data = await readSaveFile(inFile)
    const skipBackup = data.__sorted
    const sorted = await sortSaveFile(data)
    const raw = await encodeSaveFile(sorted)

    await writeJson(opts.out, inFile, raw, skipBackup)
  })

  .command('print <save-file>', 'Display the items in inventory')
  .action(async (inFile, opts) => {
    await ensureTemporaryDirectory()
    const data = await readSaveFile(inFile)
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
  })

  .command('update', 'Download the configuration files')
  .action((opts) => Promise.all([downloadItems(), downloadMappings()]))

  .command(
    'decode <save-file>',
    'Decript and decode <save-file> into human readable json'
  )
  .option(
    '-o, --out',
    'The file to write the results to. Defaults to <save-file>'
  )
  .action(async (inFile, opts) => {
    opts.out ??= inFile

    const data = await readSaveFile(inFile)
    await writeJson(opts.out, inFile, data)
  })

  .command(
    'encode <save-file>',
    'Encode <save-file> into the format expected by the game'
  )
  .option(
    '-o, --out',
    'The file to write the results to. Defaults to <save-file>'
  )
  .action(async (inFile, opts) => {
    opts.out ??= inFile

    const data = JSON.parse(await readFile(inFile))
    const raw = await encodeSaveFile(data)
    await writeJson(opts.out, inFile, raw)
  })

  .parse(process.argv)
