import _ from 'lodash'
import { getItemAttrs } from './data.js'
import { nonASCII } from './sorting.js'

const bold = (value) => `\x1b[1m${value}\x1b[0m`
const blue = (value) => `\x1b[34m${value}\x1b[0m`
const rgb = (value, r, g, b) => `\x1b[48;2;${r};${g};${b}m${value}\x1b[0m`

export async function getInventoryItems(data, term) {
  const attrs = await getItemAttrs()

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
      _.chain(inv.Slots)
        .map((item) => {
          const id = item.Id.substring(1)
          const {
            n: name = '<unknown>',
            c: category = '<unknown>',
            r,
            g,
            b,
          } = attrs[id] ?? {}

          return {
            name,
            category,
            color: { r, g, b },
            id: nonASCII.test(id) ? '<non-ascii>' : id,
            amount: String(item.Amount),
            matches: !term
              ? []
              : _.mapValues({ name, category, id }, (value) =>
                  [...value.matchAll(new RegExp(term, 'gi'))].map((match) => ({
                    start: match.index,
                    end: match.index + term.length,
                  }))
                ),
          }
        })
        .filter((value) => !term || _.flatMap(value.matches).length > 0)
        .value()
  )
}

export function printInventoryItems(items) {
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

              const pad = (col) =>
                formatted[col] + _.repeat(' ', cols[col] - item[col].length)

              const toHex = (comp) => comp.toString(16).padStart(2, '0')

              const { r, g, b } = item.color

              return [
                _.capitalize(pad('name')),
                pad('id'),
                pad('amount'),
                pad('category'),
                r === undefined
                  ? ''
                  : `${rgb('   ', r, g, b)} #${toHex(r)}${toHex(g)}${toHex(b)}`,
              ].join('\t')
            }),
            '\n',
          ]
    )
    .join('\n')
    .value()
  console.log(text)
}
