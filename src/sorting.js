import _ from 'lodash'
import { colord } from 'colord'

import { getItemAttrs } from './data.js'

function colorComparator(a, b) {
  if (a.r === undefined || b.r === undefined) {
    return 0
  }

  const colorA = colord(a).toHsl()
  const colorB = colord(b).toHsl()

  return colorA.h !== colorB.h
    ? colorA.h - colorB.h
    : colorA.s !== colorB.s
    ? colorA.s - colorB.s
    : colorB.l - colorA.l
}

function stringComparator(a, b) {
  return a === undefined || b === undefined ? 0 : a.localeCompare(b)
}

export const nonASCII = /[^\u0000-\u007f]/

async function sortSlots(items, sortOrder) {
  const itemAttrs = await getItemAttrs()
  const unreconized = new Set()

  items.sort((a, b) => {
    if (nonASCII.test(a.Id)) {
      return 1
    }

    if (nonASCII.test(b.Id)) {
      return -1
    }

    const idA = a.Id.substring(1)
    const idB = b.Id.substring(1)
    const attrsA = itemAttrs[idA]
    const attrsB = itemAttrs[idB]

    if (attrsA === undefined) {
      unreconized.add(a.Id)
      return 1
    }

    if (attrsB === undefined) {
      unreconized.add(b.Id)
      return -1
    }

    for (const attr of sortOrder) {
      let res = 0

      switch (attr) {
        case 'color':
          res = colorComparator(attrsA, attrsB)
          break

        case 'name':
          res = stringComparator(attrsA.n, attrsB.n)
          break

        case 'category':
          res = stringComparator(attrsA.c, attrsB.c)
          break

        case 'id':
          res = stringComparator(idA, idB)
          break

        default:
          console.warn('Attempted to sort by an unreconized attribute: ' + attr)
          break
      }

      if (res !== 0) {
        return res
      }
    }

    return 0
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

export async function sortSaveFile(data, { sortOrder, disableGrouping }) {
  const playerState = data.PlayerStateData

  const inventoryList = [
    playerState.Inventory,
    playerState.FreighterInventory,
    ...playerState.ShipOwnership.map((ship) => ship.Inventory),
    ...playerState.VehicleOwnership.map((vehicle) => vehicle.Inventory),
  ]

  for (const inventory of inventoryList) {
    inventory.Slots = await sortSlots(inventory.Slots, sortOrder)
    inventory.Slots = stackAdjacentSlots(inventory.Slots)
    inventory.Slots = orderSlots(inventory.Slots, inventory.ValidSlotIndices)
  }

  const chestList = [
    playerState.Chest1Inventory,
    playerState.Chest2Inventory,
    playerState.Chest3Inventory,
    playerState.Chest4Inventory,
    playerState.Chest5Inventory,
    playerState.Chest6Inventory,
    playerState.Chest7Inventory,
    playerState.Chest8Inventory,
    playerState.Chest9Inventory,
    playerState.Chest10Inventory,
  ]

  if (disableGrouping) {
    for (const chest of chestList) {
      chest.Slots = await sortSlots(chest.Slots, sortOrder)
      chest.Slots = stackAdjacentSlots(chest.Slots)
      chest.Slots = orderSlots(chest.Slots, chest.ValidSlotIndices)
    }
  } else {
    let chestGroup = await sortSlots(
      chestList.flatMap((chest) => chest.Slots),
      sortOrder
    )
    chestGroup = stackAdjacentSlots(chestGroup)
    chestGroup = orderSlots(
      chestGroup,
      chestList.flatMap((chest) => chest.ValidSlotIndices)
    )

    let i = 0
    for (const chest of chestList) {
      const end = i + chest.ValidSlotIndices.length
      chest.Slots = chestGroup.slice(i, end)
      i = end
    }
  }

  data.__sorted = true

  return data
}
