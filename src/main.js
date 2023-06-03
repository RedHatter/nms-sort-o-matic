import { writeFile, readFile, mkdir } from 'node:fs/promises'
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

async function ensureTemporaryDirectory() {
  try {
    await mkdir('tmp')
  } catch (e) {
    if (e.code !== 'EEXIST') {
      console.error(e)
    }
  }
}

async function getNames() {
  const items = await getItems()
  return _.mapValues(items, ([name, category]) => name)
}

async function getCategories() {
  const items = await getItems()
  return _.mapValues(items, ([name, category]) => category)
}

const getItems = _.memoize(async () => {
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
    .mapValues((row) => [
      row['Translated Name'] ?? row['TRANSLATED NAME'] ?? row['EN_Name'],
      row.Category,
    ])
    .value()

  await ensureTemporaryDirectory()
  await writeFile(path.join('tmp', 'items.json'), JSON.stringify(items))

  return items
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
  await ensureTemporaryDirectory()
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
      return buf.toString('binary')
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

  return Buffer.concat(chunks).toString('binary').slice(0, -1)
}

const nonASCII = /[^\u0000-\u007f]/

function sortSlots(items, categories) {
  const unreconized = new Set()

  items.sort((a, b) => {
    if (nonASCII.test(a.Id)) {
      return 1
    }

    if (nonASCII.test(b.Id)) {
      return -1
    }

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
      ).join()}. Is 'items.json' out of date?`
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

export async function getInventoryItems(data) {
  const categories = await getCategories()
  const names = await getNames()

  return _.mapValues(
    {
      Inventory: data.PlayerStateData.Inventory,
      ..._.chain(data.PlayerStateData.ShipOwnership)
        .mapKeys((value, i) => `Ship ${value.Name ?? parseInt(i) + 1}`)
        .mapValues('Inventory')
        .value(),
      ..._.chain(data.PlayerStateData.VehicleOwnership)
        .mapKeys((value, i) => `Exocraft ${value.Name ?? parseInt(i) + 1}`)
        .mapValues('Inventory')
        .value(),
      'Chest 1': data.PlayerStateData.Chest1Inventory,
      'Chest 2': data.PlayerStateData.Chest2Inventory,
      'Chest 3': data.PlayerStateData.Chest3Inventory,
      'Chest 4': data.PlayerStateData.Chest4Inventory,
      'Chest 5': data.PlayerStateData.Chest5Inventory,
      'Chest 6': data.PlayerStateData.Chest6Inventory,
      'Chest 7': data.PlayerStateData.Chest7Inventory,
      'Chest 8': data.PlayerStateData.Chest8Inventory,
      'Chest 9': data.PlayerStateData.Chest9Inventory,
      'Chest 10': data.PlayerStateData.Chest10Inventory,
    },
    (inv) =>
      inv.Slots?.map((item) => {
        const id = item.Id.substring(1)

        return {
          id,
          name: names[id] ?? '<unknown>',
          amount: String(item.Amount),
          category: categories[id] ?? '<unknown>',
        }
      })
  )
}
