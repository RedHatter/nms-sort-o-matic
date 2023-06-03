import { readFile, writeFile, copyFile } from 'node:fs/promises'
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

const bold = (value) => `\x1b[1m${value}\x1b[0m`
const blue = (value) => `\x1b[34m${value}\x1b[0m`

async function writeJson(outFile, inFile, data, skipBackup) {
  if (outFile === inFile) {
    if (skipBackup) {
      console.log('Detected already edited save file. Skipping backup.')
    } else {
      await copyFile(inFile, inFile + '.bk')
    }
  }

  await writeFile(outFile, JSON.stringify(data), { encoding: 'binary' })
}

function printItems(items) {
  const cols = _.chain(items)
    .flatMap()
    .compact()
    .reduce(
      (cols, item) => ({
        ...cols,
        ..._.mapValues(item, (value, key) =>
          typeof value === 'string' ? Math.max(value.length, cols[key] ?? 0) : 0
        ),
      }),
      {}
    )
    .value()
  const text = _.chain(items)
    .flatMap((value, key) =>
      !value || value.length < 1
        ? []
        : [
            bold(key),
            _.repeat('-', key.length),
            ...value.map((item) => {
              const formatted = _.omit(item, 'matches')

              for (const key in item.matches) {
                for (const { start, end } of item.matches[key]) {
                  const value = item[key]
                  formatted[key] =
                    value.substring(0, start) +
                    bold(blue(value.substring(start, end))) +
                    value.substring(end)
                }
              }

              return [
                _.capitalize(formatted.name) +
                  _.repeat(' ', cols.name - item.name.length),
                formatted.id + _.repeat(' ', cols.id - item.id.length),
                formatted.amount +
                  _.repeat(' ', cols.amount - item.amount.length),
                formatted.category +
                  _.repeat(' ', cols.category - item.category.length),
              ].join('\t')
            }),
            '\n',
          ]
    )
    .join('\n')
    .value()
  console.log(text)
}

sade(pkg.name)
  .version(pkg.version)
  .describe(pkg.description)
  .command('sort <save-file>', 'Sort all inventories', { default: true })
  .option(
    '-o, --out',
    'The file to write the results to. Defaults to <save-file>'
  )
  .action(async (inFile, opts) => {
    opts.out ??= inFile

    const data = await readSaveFile(inFile)
    const skipBackup = data.__sorted
    const sorted = await sortSaveFile(data)
    const raw = await encodeSaveFile(sorted)

    await writeJson(opts.out, inFile, raw, skipBackup)
  })

  .command('print <save-file>', 'Display the items in all inventories')
  .action(async (inFile) => {
    const data = await readSaveFile(inFile)
    const inventoryItems = await getInventoryItems(data)

    printItems(inventoryItems)
  })

  .command(
    'find <save-file> <search-term>',
    'Search for <search-term> in all inventories'
  )
  .action(async (inFile, term) => {
    const data = await readSaveFile(inFile)
    const inventoryItems = await getInventoryItems(data)
    const res = _.mapValues(inventoryItems, (items) =>
      _.chain(items)
        .map((item) => ({
          ...item,
          matches: _.mapValues(item, (value) =>
            [...value.matchAll(new RegExp(term, 'gi'))].map((match) => ({
              start: match.index,
              end: match.index + term.length,
            }))
          ),
        }))
        .filter((value) => _.flatMap(value.matches).length > 0)
        .value()
    )
    printItems(res)
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
