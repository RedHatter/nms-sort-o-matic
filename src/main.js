import { writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import https from 'node:https'
import { parse as parseCsv } from 'csv-parse/sync'
import lz4 from 'lz4'
import _ from 'lodash'

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

const getCategories = _.memoize(async () => {
  try {
    const raw = await readFile(path.join('tmp', 'categories.json'), {
      encoding: 'utf8',
    })
    return JSON.parse(raw)
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code !== 'ENOENT') {
      console.error(e)
    }
  }

  return downloadCategories()
})

export async function downloadCategories() {
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

  const categories = _.chain(data)
    .flatten()
    .keyBy('ID')
    .mapValues('Category')
    .value()

  await writeFile(
    path.join('tmp', 'categories.json'),
    JSON.stringify(categories)
  )

  return categories
}

const getMappings = _.memoize(async () => {
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
  await writeFile(
    path.join('tmp', 'mapping.json'),
    JSON.stringify(data.Mapping)
  )

  return data.Mapping
}

function decode(data, mappings) {
  return !data || typeof data !== 'object'
    ? data
    : Array.isArray(data)
    ? data.map((value) => decode(value, mappings))
    : _.chain(data)
        .mapKeys((value, key) => mappings[key] ?? key)
        .mapValues((value) => decode(value, mappings))
        .value()
}

function decompress(buf) {
  let index = 0
  let chunks = []

  while (index < buf.length) {
    const magic = buf.readUIntLE(index, 4)
    index += 4

    if (magic != 0xfeeda1e5) {
      console.error('Invalid Block assuming already decompressed')
      return buf.toString('utf8')
    }

    const compressedSize = buf.readUIntLE(index, 4)
    index += 4
    const uncompressedSize = buf.readUIntLE(index, 4)
    index += 4

    index += 4 // skip 4 bytes

    const output = Buffer.alloc(uncompressedSize)
    lz4.decodeBlock(buf, output, index, index + compressedSize)
    index += compressedSize

    chunks.push(output)
  }

  return Buffer.concat(chunks).toString('utf8').slice(0, -1)
}

function sortSlots(items, categories) {
  const unreconized = new Set()

  items.sort((a, b) => {
    const aCat = categories[a.Id.substring(1)]
    const bCat = categories[b.Id.substring(1)]

    if (!aCat) {
      unreconized.add(a.Id)
    }

    if (!bCat) {
      unreconized.add(b.Id)
    }

    return !aCat || !bCat || aCat === bCat
      ? a.Id.localeCompare(b.Id)
      : aCat.localeCompare(bCat)
  })

  if (unreconized.size > 0) {
    console.warn(
      `Unreconized item ids: ${Array.from(
        unreconized
      ).join()}. Is 'categories.json' out of date?`
    )
  }

  return items
}

function stackAdjacentSlots(items) {
  for (let i = 0; i < items.length; i++) {
    const slot = items[i]
    const prev = items[i - 1]

    if (
      !prev ||
      !_.isEqualWith(slot, prev, (a, b, key) =>
        key === 'Amount' || key === 'Index' ? true : undefined
      )
    )
      continue

    const amount = Math.min(slot.Amount, prev.MaxAmount - prev.Amount)

    if (amount <= 0) continue

    slot.Amount -= amount
    prev.Amount += amount
  }

  return items.filter((slot) => slot.Amount > 0)
}

function orderSlots(items, slots) {
  for (const i in items) {
    items[i].Index.X = slots[i].X
    items[i].Index.Y = slots[i].Y
  }

  return items
}

export async function readSaveFile(filepath) {
  const rawMappings = await getMappings()
  const mappings = _.chain(rawMappings).keyBy('Key').mapValues('Value').value()

  const raw = await readFile(filepath)
  return decode(JSON.parse(decompress(raw)), mappings)
}

export async function encodeSaveFile(data) {
  const rawMappings = await getMappings()
  const mappings = _.chain(rawMappings).keyBy('Value').mapValues('Key').value()

  return decode(data, mappings)
}

export async function sortSaveFile(data) {
  const categories = await getCategories()

  const inventoryList = [
    data.PlayerStateData.Inventory,
    ...data.PlayerStateData.ShipOwnership.map((ship) => ship.Inventory),
    ...data.PlayerStateData.VehicleOwnership.map(
      (vehicle) => vehicle.Inventory
    ),
  ]

  for (const inventory of inventoryList) {
    inventory.Slots = sortSlots(inventory.Slots, categories)
    inventory.Slots = stackAdjacentSlots(inventory.Slots)
    inventory.Slots = orderSlots(inventory.Slots, inventory.ValidSlotIndices)
  }

  const chestList = [
    data.PlayerStateData.Chest1Inventory,
    data.PlayerStateData.Chest2Inventory,
    data.PlayerStateData.Chest3Inventory,
    data.PlayerStateData.Chest4Inventory,
    data.PlayerStateData.Chest5Inventory,
    data.PlayerStateData.Chest6Inventory,
    data.PlayerStateData.Chest7Inventory,
    data.PlayerStateData.Chest8Inventory,
    data.PlayerStateData.Chest9Inventory,
    data.PlayerStateData.Chest10Inventory,
  ]

  let combinedChests = sortSlots(
    chestList.flatMap((chest) => chest.Slots),
    categories
  )
  combinedChests = stackAdjacentSlots(combinedChests)
  combinedChests = orderSlots(
    combinedChests,
    chestList.flatMap((chest) => chest.ValidSlotIndices)
  )

  let i = 0
  for (const chest of chestList) {
    const end = i + chest.ValidSlotIndices.length
    chest.Slots = combinedChests.slice(i, end)
    i = end
  }

  data.__sorted = true

  return data
}
