import { readFile } from 'node:fs/promises'
import _ from 'lodash'
import lz4 from 'lz4'
import { getMappings } from './data.js'

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
