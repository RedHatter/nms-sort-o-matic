import test from 'ava'
import { execSync, spawnSync } from 'node:child_process'
import pkg from '../package.json' assert { type: 'json' }
import { uid } from 'uid'
import path from 'node:path'
import { mkdir, rm, rmdir, copyFile, readFile, stat } from 'node:fs/promises'

const run = (args, cwd) =>
  execSync(`"${path.join(process.cwd(), 'dist', pkg.name)}" ${args}`, { cwd })

const getTemporaryDirectory = async (t) => {
  const dir = path.join('tmp', uid())
  await mkdir(path.join(dir, 'tmp'), { recursive: true })

  t.teardown(() => rm(dir, { recursive: true }))

  return dir
}

test.after(() => rmdir('tmp'))

test('prints help text', (t) => {
  const output = run('--help')
  t.snapshot(output.toString('utf8'))
})

test('decodes save file', async (t) => {
  const dir = await getTemporaryDirectory(t)

  await copyFile(
    path.join('test', 'fixtures', 'mapping.json'),
    path.join(dir, 'tmp', 'mapping.json')
  )
  await copyFile(
    path.join('test', 'fixtures', 'save.hg'),
    path.join(dir, 'save.hg')
  )

  run('-d -o save.json', dir)

  const raw = JSON.parse(await readFile(path.join(dir, 'save.json')))
  t.snapshot(raw)
})

test('encodes save file', async (t) => {
  const dir = await getTemporaryDirectory(t)

  await copyFile(
    path.join('test', 'fixtures', 'mapping.json'),
    path.join(dir, 'tmp', 'mapping.json')
  )
  await copyFile(
    path.join('test', 'fixtures', 'save.json'),
    path.join(dir, 'save.json')
  )

  run('-e -i save.json -o save.hg', dir)

  const raw = JSON.parse(await readFile(path.join(dir, 'save.hg')))
  t.snapshot(raw)
})

test('sorts save file', async (t) => {
  const dir = await getTemporaryDirectory(t)

  await copyFile(
    path.join('test', 'fixtures', 'mapping.json'),
    path.join(dir, 'tmp', 'mapping.json')
  )
  await copyFile(
    path.join('test', 'fixtures', 'items.json'),
    path.join(dir, 'tmp', 'items.json')
  )
  await copyFile(
    path.join('test', 'fixtures', 'save.hg'),
    path.join(dir, 'save.hg')
  )

  run('', dir)

  const raw = JSON.parse(await readFile(path.join(dir, 'save.hg')))
  t.snapshot(raw)

  t.assert((await stat(path.join(dir, 'save.hg.bk'))).isFile())
})

test('downloads configuration files', async (t) => {
  const dir = await getTemporaryDirectory(t)

  run('-u', dir)

  const mappings = JSON.parse(
    await readFile(path.join(dir, 'tmp', 'mapping.json'))
  )
  t.deepEqual(Object.keys(mappings[0]), ['Key', 'Value'])

  const items = JSON.parse(await readFile(path.join(dir, 'tmp', 'items.json')))
  t.assert(Array.isArray(items['EX_RED']))
})

test('prints inventory items', async (t) => {
  const dir = await getTemporaryDirectory(t)

  await copyFile(
    path.join('test', 'fixtures', 'items.json'),
    path.join(dir, 'tmp', 'items.json')
  )
  await copyFile(
    path.join('test', 'fixtures', 'save.hg'),
    path.join(dir, 'save.hg')
  )

  const output = run('-p', dir)
  t.snapshot(output.toString('utf8'))
})
