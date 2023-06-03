import { readFile, writeFile, copyFile } from 'node:fs/promises'
import _ from 'lodash'
import sade from 'sade'
import pkg from '../package.json' assert { type: 'json' }
import {
  readSaveFile,
  encodeSaveFile,
  sortSaveFile,
  downloadItems,
  downloadMappings,
  getInventoryItems,
  printInventoryItems,
} from './main.js'

sade(pkg.name)
  .version(pkg.version)
  .describe(pkg.description)
  .command('sort <save-file>', 'Sort all inventories', { default: true })
  .option(
    '-o, --out',
    'The file to write the results to. Defaults to <save-file>'
  )
  .option(
    '-s, --sort',
    'List of attributes to sort by. Any of name, id, category, or color',
    'category,color,id'
  )
  .option('-p, --print', 'Display contents of all inventories when done')
  .action(async (inFile, opts) => {
    opts.out ??= inFile

    const data = await readSaveFile(inFile)
    const skipBackup = data.__sorted
    const sorted = await sortSaveFile(data, opts.sort.split(/\s*,\s*/))
    const raw = await encodeSaveFile(sorted)

    if (opts.out === inFile) {
      if (skipBackup) {
        console.log('Detected already edited save file. Skipping backup.')
      } else {
        await copyFile(inFile, inFile + '.bk')
      }
    }

    await writeFile(opts.out, JSON.stringify(raw), { encoding: 'binary' })

    if (opts.print) {
      const inventoryItems = await getInventoryItems(sorted)
      printInventoryItems(inventoryItems)
    }
  })

  .command('print <save-file>', 'Display contents of all inventories')
  .action(async (inFile) => {
    const data = await readSaveFile(inFile)
    const inventoryItems = await getInventoryItems(data)

    printInventoryItems(inventoryItems)
  })

  .command(
    'find <save-file> <search-term>',
    'Search for <search-term> in all inventories'
  )
  .action(async (inFile, term) => {
    const data = await readSaveFile(inFile)
    const items = await getInventoryItems(data, term)

    printInventoryItems(items)
  })

  .command('update', 'Download the configuration files')
  .action((opts) => Promise.all([downloadItems(), downloadMappings()]))

  .command(
    'decode <save-file>',
    'Decript and decode <save-file> into human readable json'
  )
  .option(
    '-o, --out',
    'The file to write the results to. By default writes to stdout.'
  )
  .action(async (inFile, opts) => {
    const data = await readSaveFile(inFile)

    if (opts.out) {
      await writeFile(opts.out, JSON.stringify(data), { encoding: 'binary' })
    } else {
      console.log(JSON.stringify(data))
    }
  })

  .command(
    'encode <save-file>',
    'Encode <save-file> into the format expected by the game'
  )
  .option(
    '-o, --out',
    'The file to write the results to. By default writes to stdout.'
  )
  .action(async (inFile, opts) => {
    const data = JSON.parse(await readFile(inFile))
    const raw = await encodeSaveFile(data)

    if (opts.out) {
      await writeFile(opts.out, JSON.stringify(raw), { encoding: 'binary' })
    } else {
      console.log(JSON.stringify(raw))
    }
  })

  .parse(process.argv)
