import { writeFile, readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import https from 'node:https'
import _ from 'lodash'
import { parse as parseCsv } from 'csv-parse/sync'

function get(url) {
  return new Promise((resolve, reject) =>
    https
      .get(url, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          get(res.headers.location).then(resolve).catch(reject)
          return
        }

        const body = []

        res.on('data', (chunk) => body.push(chunk))
        res.on('end', () => resolve(Buffer.concat(body).toString('utf8')))
      })
      .on('error', reject)
  )
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

function normalizeColor(comp) {
  return comp === undefined
    ? undefined
    : Math.round(255 * parseFloat(comp.replace(',', '.')))
}

export const getItemAttrs = _.memoize(async () => {
  try {
    const raw = await readFile(path.join('tmp', 'items.json'), {
      encoding: 'utf8',
    })
    return JSON.parse(raw)
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code !== 'ENOENT') {
      console.error(e)
    }
  }

  return downloadItems()
})

export async function downloadItems() {
  const data = await Promise.all(
    ['66931870', '984581625', '1672062070', '874018846'].map(async (sheet) =>
      parseCsv(
        await get(
          `https://docs.google.com/spreadsheets/d/1J8WdrubKgo8A9hPY-hbQLq4eVrb3n3lZAgiI2J7ncAU/export?format=csv&gid=${sheet}`
        ),
        {
          columns: true,
          skip_empty_lines: true,
        }
      )
    )
  )

  const items = _.chain(data)
    .flatten()
    .keyBy('ID')
    .mapValues((row) => {
      const [r, g, b] = row['Colour']?.split(',') ?? []

      return {
        n: row['Translated Name'] ?? row['TRANSLATED NAME'] ?? row['EN_Name'],
        c: row.Category,
        r: normalizeColor(row['Colour.R'] ?? r),
        g: normalizeColor(row['Colour.G'] ?? g),
        b: normalizeColor(row['Colour.B'] ?? b),
      }
    })
    .value()

  await ensureTemporaryDirectory()
  await writeFile(path.join('tmp', 'items.json'), JSON.stringify(items))

  return items
}

export const getMappings = _.memoize(async () => {
  try {
    const raw = await readFile(path.join('tmp', 'mapping.json'), {
      encoding: 'utf8',
    })
    return JSON.parse(raw)
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code !== 'ENOENT') {
      console.error(e)
    }
  }

  return downloadMappings()
})

export async function downloadMappings() {
  const raw = await get(
    'https://github.com/monkeyman192/MBINCompiler/releases/latest/download/mapping.json'
  )
  const data = JSON.parse(raw)
  await ensureTemporaryDirectory()
  await writeFile(
    path.join('tmp', 'mapping.json'),
    JSON.stringify(data.Mapping)
  )

  return data.Mapping
}
