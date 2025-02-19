
import { existsSync, lstatSync } from 'node:fs'
import { resolve, normalize, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import untildify from 'untildify'

import { getPngSize } from './get-png-size.js'
import { warn } from './logger.js'
import { generators } from '../generators/index.js'
import { defaultParams } from './default-params.js'
import { appDir } from './app-paths.js'
import { modes } from '../modes/index.js'

const modesList = Object.keys(modes)

function die (msg) {
  warn(msg)
  warn()
  process.exit(1)
}

function profile (value, argv) {
  if (!value) return

  const profilePath = resolve(process.cwd(), untildify(value))

  if (!existsSync(profilePath)) {
    die(`Profile param does not point to a file or folder that exists!`)
  }

  if (
    !value.endsWith('.json')
    && !lstatSync(profilePath).isDirectory()
  ) {
    die(`Specified profile (${ value }) is not a .json file`)
  }

  argv.profile = profilePath
}

function mode (value, argv) {
  if (!value) {
    argv.mode = modesList
    return
  }

  const list = value.split(',')

  if (list.includes('all')) {
    argv.mode = modesList
    return
  }

  if (list.some(mode => !modesList.includes(mode))) {
    die(`Invalid mode requested: "${ value }"`)
  }

  argv.mode = list
}

function include (value, argv) {
  if (!value) return

  if (value.includes('all')) {
    argv.include = modesList
    return
  }

  if (value.some(mode => !modesList.includes(mode))) {
    die(`Invalid include requested: "${ value }"`)
  }
}

function quality (value, argv) {
  if (!value) {
    argv.quality = defaultParams.quality
    return
  }

  const numeric = parseInt(value, 10)

  if (isNaN(numeric)) {
    die(`Invalid quality level number specified`)
  }
  if (numeric < 1 || numeric > 12) {
    die(`Invalid quality level specified (${ value }) - should be between 1 - 12`)
  }

  argv.quality = numeric
}

function filter (value) {
  if (value && !Object.keys(generators).includes(value)) {
    die(`Unknown filter value specified (${ value }); there is no such generator`)
  }
}

function padding (value, argv) {
  if (!value) {
    argv.padding = [ 0, 0 ]
    return
  }

  const sizes = (Array.isArray(value) ? value : value.split(','))
    .map(val => parseInt(val, 10))

  if (sizes.length > 2) {
    die(`Invalid padding specified`)
  }

  sizes.forEach(size => {
    if (isNaN(size)) {
      die(`Invalid padding specified (not numbers)`)
    }
    if (size < 0) {
      die(`Invalid padding specified (not all positive numbers)`)
    }
  })

  argv.padding = sizes.length === 1
    ? [ sizes[ 0 ], sizes[ 0 ] ]
    : sizes
}

function parseIconPath (value) {
  const __path = untildify(value)

  if (isAbsolute(__path)) {
    return existsSync(__path) === true
      ? __path
      : null
  }

  let icon = resolve(process.cwd(), __path)

  if (existsSync(icon)) {
    return icon
  }

  icon = resolve(appDir, __path)

  return existsSync(icon) ? icon : null
}

function icon (value, argv) {
  if (!value) {
    warn(`No source icon file specified, so using the sample one`)
    argv.icon = normalize(
      fileURLToPath(
        new URL('../../samples/icongenie-icon.png', import.meta.url)
      )
    )
    return
  }

  argv.icon = parseIconPath(value)

  if (!argv.icon) {
    die(`Path to source icon file does not exists: "${ value }"`)
  }

  const { width, height } = getPngSize(argv.icon)

  if (width === 0 && height === 0) {
    die(`Icon source is not a PNG file!`)
  }

  if (width < 64 || height < 64) {
    die(`Icon source file does not have the minimum 64x64px resolution`)
  }
}

function background (value, argv) {
  if (!value) return

  argv.background = resolve(appDir, untildify(value))

  if (!existsSync(argv.background)) {
    die(`Path to background source file does not exists: "${ value }"`)
  }

  const { width, height } = getPngSize(argv.background)

  if (width === 0 && height === 0) {
    die(`Background source file is not a PNG file!`)
  }

  if (width < 128 || height < 128) {
    die(`Background source file does not have the minimum 128x128px resolution`)
  }
}

function getColorParser (name, defaultValue) {
  return (value, argv) => {
    if (!value) {
      argv[ name ] = argv.themeColor || defaultValue
      return
    }

    if (
      (value.length !== 3 && value.length !== 6)
      || /^[0-9A-Fa-f]+$/.test(value) !== true
    ) {
      die(`Invalid ${ name } color specified: "${ value }"`)
    }

    argv[ name ] = '#' + value
  }
}

function splashscreenIconRatio (value, argv) {
  if (!value && value !== 0) {
    argv.splashscreenIconRatio = defaultParams.splashscreenIconRatio
    return
  }

  const numeric = parseFloat(value)

  if (isNaN(numeric)) {
    die(`Invalid splashscreen icon ratio number specified`)
  }
  if (numeric < 0 || numeric > 100) {
    die(`Invalid splashscreen icon ratio specified (${ value }) - should be between 0 - 100`)
  }

  argv.splashscreenIconRatio = numeric
}

function output (value) {
  if (!value) {
    die(`The "output" param is required`)
  }
}

function assets (value, argv) {
  if (!value) {
    argv.assets = []
    return
  }

  const list = value.split(',')

  if (list.includes('all')) {
    argv.assets = modesList
    return
  }

  if (list.some(mode => !modesList.includes(mode))) {
    die(`Invalid assets requested: "${ value }"`)
  }

  argv.assets = list
}

const parsers = {
  profile,
  mode,
  quality,
  filter,
  padding,
  icon,
  background,
  splashscreenIconRatio,

  themeColor: getColorParser('themeColor'),
  pngColor: getColorParser('pngColor', defaultParams.pngColor),
  splashscreenColor: getColorParser('splashscreenColor', defaultParams.splashscreenColor),
  svgColor: getColorParser('svgColor', defaultParams.svgColor),

  include, // profile file param

  output, // profile cmd
  assets // profile cmd
}

export function parseArgv (argv, list) {
  list.forEach(name => {
    const fn = parsers[ name ]
    if (fn === void 0) {
      die(`Invalid command parameter specified (${ name })`)
    }

    fn(argv[ name ], argv)
  })
}
