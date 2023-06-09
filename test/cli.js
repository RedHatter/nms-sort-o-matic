import test from 'ava'
import { execSync, spawnSync } from 'node:child_process'
import pkg from '../package.json' assert { type: 'json' }
import { uid } from 'uid'
import path from 'node:path'
import { mkdir, rm, rmdir, copyFile, readFile, stat } from 'node:fs/promises'

const platform =
  process.platform === 'win32'
    ? 'win'
    : process.platform === 'darwin'
    ? 'macos'
    : 'linux'

const run = (args, cwd) =>
  execSync(
    `"${path.join(process.cwd(), 'dist', `${pkg.name}-${platform}`)}" ${args}`,
    { cwd }
  )

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

  run('decode save.hg -o save.json', dir)

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

  run('encode save.json -o save.hg', dir)

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

  run('save.hg', dir)

  const raw = JSON.parse(await readFile(path.join(dir, 'save.hg')))
  t.snapshot(raw)

  t.assert((await stat(path.join(dir, 'save.hg.bk'))).isFile())
})

test('downloads configuration files', async (t) => {
  const dir = await getTemporaryDirectory(t)

  run('update', dir)

  const mappings = JSON.parse(
    await readFile(path.join(dir, 'tmp', 'mapping.json'))
  )
  t.deepEqual(Object.keys(mappings[0]), ['Key', 'Value'])

  const items = JSON.parse(await readFile(path.join(dir, 'tmp', 'items.json')))
  t.deepEqual(Object.keys(items['EX_RED']), ['n', 'c', 'r', 'g', 'b'])
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

  const output = run('print save.hg', dir)
  t.snapshot(output.toString('utf8'))
})

test('finds inventory items', async (t) => {
  const dir = await getTemporaryDirectory(t)

  await copyFile(
    path.join('test', 'fixtures', 'items.json'),
    path.join(dir, 'tmp', 'items.json')
  )
  await copyFile(
    path.join('test', 'fixtures', 'save.hg'),
    path.join(dir, 'save.hg')
  )

  const output = run('find save.hg fuel', dir)
  t.snapshot(output.toString('utf8'))
})
