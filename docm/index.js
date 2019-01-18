const yargs = require('yargs');
const fs = require('fs-extra');
const envDotProp = require('env-dot-prop');
const get = require('lodash/get');
const titleize = require('titleize');
const humanize = require('humanize-string');
const path = require('path');

const populateNodePath = () => {
  // We support resolving modules according to `NODE_PATH`.
  // It works similar to `NODE_PATH` in Node itself:
  // https://nodejs.org/api/modules.html#modules_loading_from_the_global_folders
  // Note that unlike in Node, only *relative* paths from `NODE_PATH` are honored.
  // Otherwise, we risk importing Node.js core modules into an app instead of Webpack shims.
  // https://github.com/facebook/create-react-app/issues/1023#issuecomment-265344421
  // We also resolve them to make sure all tools using them work consistently.
  envDotProp.set(
    'node.path',
    envDotProp
      .get('node.path', '')
      .split(path.delimiter)
      .filter((folder) => folder && !path.isAbsolute(folder))
      .map((folder) => path.resolve(root, folder))
      .join(path.delimiter)
  )
}
const root = fs.realpathSync(process.cwd())
const resolveApp = (to) => path.resolve(root, to)
const configDotEnv = () => {
  const NODE_ENV = envDotProp.get('node.env')
  const dotenv = resolveApp('.env')

  const dotenvFiles = [
    `${dotenv}.${NODE_ENV}.local`,
    `${dotenv}.${NODE_ENV}`,
    // Don't include `.env.local` for `test` environment
    // since normally you expect tests to produce the same
    // results for everyone
    NODE_ENV !== 'test' && `${dotenv}.local`,
    dotenv,
  ]

  // Load environment variables from .env* files. Suppress warnings using silent
  // if this file is missing. dotenv will never modify any environment variables
  // that have already been set.  Variable expansion is supported in .env files.
  // https://github.com/motdotla/dotenv
  dotenvFiles.filter(Boolean).forEach(dotenvFile => {
    require('dotenv').config({
      path: dotenvFile,
    })
  })
}

const setEnv = (env) => {
  
  envDotProp.set('babel.env', env)
  envDotProp.set('node.env', env)
  configDotEnv()
  populateNodePath()
}

const removeScope = (name) => name.replace(/^@.*\//, '')

const getInitialTitle = (pkg) => {
  const name = get(pkg, 'name') || 'MyDoc'
  return titleize(humanize(removeScope(name)))
}

const getInitialDescription = (pkg) =>
  get(pkg, 'description') || 'My awesome app using docm'

const getEnv = (val, defaultValue) =>
  envDotProp.get(val, defaultValue, { parse: true })

const defaultArgs = (env) => (yargs) => {
  const pkg = fs.readJsonSync('./package.json', { throws: false })
  setEnv(env)
  yargs.positional('base', {
    type: 'string',
    default: getEnv('docm.base', '/'),
  })
  yargs.positional('source', {
    alias: 'src',
    type: 'string',
    default: getEnv('docm.source', './'),
  })
  yargs.positional('files', {
    type: 'string',
    default: getEnv('docm.files', '**/*.mdx'),
  })
  yargs.positional('ignore', {
    type: 'array',
    default: getEnv('docm.ignore', []),
  })
  yargs.positional('public', {
    type: 'string',
    default: getEnv('docm.public', '/public'),
  })
  yargs.positional('dest', {
    alias: 'd',
    type: 'string',
    default: getEnv('docm.dest', '.docm/dist'),
  })
  yargs.positional('editBranch', {
    alias: 'eb',
    type: 'string',
    default: getEnv('docm.edit.branch', 'master'),
  })
  yargs.positional('config', {
    type: 'string',
    default: getEnv('docm.config', ''),
  })
  yargs.positional('title', {
    type: 'string',
    default: getEnv('docm.title', getInitialTitle(pkg)),
  })
  yargs.positional('description', {
    type: 'string',
    default: getEnv('docm.description', getInitialDescription(pkg)),
  })
  yargs.positional('theme', {
    type: 'string',
    default: getEnv('docm.theme', 'docm-theme-default'),
  })
  yargs.positional('typescript', {
    alias: 'ts',
    type: 'boolean',
    default: getEnv('docm.typescript', false),
  })
  yargs.positional('propsParser', {
    type: 'boolean',
    default: getEnv('docm.props.parser', true),
  })
  yargs.positional('wrapper', {
    type: 'string',
    default: getEnv('docm.wrapper', null),
  })
  yargs.positional('indexHtml', {
    type: 'string',
    default: getEnv('docm.index.html', null),
  })
  yargs.positional('ordering', {
    type: 'string',
    default: getEnv('docm.ordering', 'descending'),
  })
  yargs.positional('debug', {
    type: 'boolean',
    default: getEnv('docm.debug', false),
  })
  yargs.positional('host', {
    type: 'string',
    default: getEnv('docm.host', '127.0.0.1'),
  })
  yargs.positional('port', {
    alias: 'p',
    type: 'number',
    default: getEnv('docm.port', 3000),
  })
  yargs.positional('websocketHost', {
    type: 'string',
    default: getEnv('docm.websocket.host', '127.0.0.1'),
  })
  yargs.positional('websocketPort', {
    type: 'number',
    default: getEnv('docm.websocket.port', 60505),
  })
  yargs.positional('hahRouter', {
    type: 'boolean',
    default: getEnv('docm.hash.router', false),
  })
  yargs.positional('native', {
    type: 'boolean',
    default: getEnv('docm.native', false),
  })
  yargs.positional('codeSandbox', {
    type: 'boolean',
    default: getEnv('docm.codeSandbox', true),
  })
  yargs.positional('sourcemaps', {
    type: 'boolean',
    default: getEnv('docm.sourcemaps', true),
  })
}
const dev = async (args) => {
  const env = envDotProp.get('node.env')
  console.log(args)
  const config = await loadConfig(args)
  const port = await detectPort(config.port)
  const websocketPort = await detectPort(config.websocketPort)
  const newConfig = { ...config, websocketPort, port }
  const bundler = webpack(newConfig, env)
  const entries = new Entries(config)

  const bundlerConfig = await bundler.mountConfig(env)
  const app = await promiseLogger(
    bundler.createApp(bundlerConfig),
    'Creating app...'
  )

  try {
    await promiseLogger(Entries.writeApp(newConfig, true), 'Parsing mdx files')
  } catch (err) {
    logger.fatal('Failed to build your files:', err)
    process.exit(1)
  }

  const server = await promiseLogger(app.start(), 'Starting your server')
  const dataServer = new DataServer(
    server.listeningApp,
    websocketPort,
    config.websocketHost
  )

  dataServer.register([
    states.config(newConfig),
    states.entries(entries, newConfig),
  ])

  try {
    await promiseLogger(dataServer.init(), 'Initializing data server')
    await dataServer.listen()
  } catch (err) {
    logger.fatal('Failed to process your server:', err)
    await dataServer.close()
    process.exit(1)
  }

  onSignal(async () => {
    await dataServer.close()
    server.close()
  })

  server.listeningApp.on('close', async () => {
    await dataServer.close()
  })
}

const commands = {
  dev
}

const execCommand = cmd => async args => {
  commands[cmd](args)
}

yargs
  .command(
    'dev',
    'initialize docm dev server',
    defaultArgs('development'),
    execCommand('dev')
  )
  .command(
    'build',
    'build dir as static site',
    defaultArgs('production'),
    async args => {
      await execCommand('build')(args)
      process.exit()
    }
  )
  .demandCommand() // 命令
  .help() // 帮助
  .wrap(72) // 换行
  .epilog('for more information visit https://docm.netlify.com') // 说明消息
  .showHelpOnFail(false, 'whoops, something went wrong! run with --help') // 输出使用字符串
  .argv
