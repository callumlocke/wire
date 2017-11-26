/* eslint-disable import/no-extraneous-dependencies */

require('hard-rejection/register')

const execa = require('execa')
const path = require('path')

const pkg = require('../package.json')

const projectRoot = path.resolve(__dirname, '..')

// Do this asynchronously
;(async () => {
  let versions

  try {
    ({ versions } = JSON.parse(await execa.stdout('npm', ['info', 'wire', '--json'], {
      cwd: projectRoot,
    })))
  } catch (error) {
    console.error('Failed to query npm for already-published versions')
    throw error
  }

  if (versions.indexOf(pkg.version) === -1) {
    await execa('npm', ['publish'], { cwd: projectRoot })
  } else {
    console.log(`Version ${pkg.version} is already on npm; skipping publish.`)
  }
})()
