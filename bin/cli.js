#!/usr/bin/env node
import { startDevServer } from '../src/devServer.js'

const args = process.argv.slice(2)
const command = args[0]

const options = {
  routesDir: './routes',
  host: 'localhost',
  port: 3000,
  publicDir: './public',
  publicMountPath: '/public'
}

function printHelp() {
  console.log(`
ArmorPage - File-based routing

Usage:
  armorpage dev

Options:
  --routes <path>          Routes directory path (default: ./routes)
  --host <host>            Server host (default: localhost)
  --port <port>            Server port (default: 3000)
  --public <path>          Static public directory (default: ./public)
  --public-mount <path>    Static mount path (default: /public)
`)
}

// Parse CLI args
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--routes' && args[i + 1]) {
    options.routesDir = args[++i]
  } else if (args[i] === '--host' && args[i + 1]) {
    options.host = args[++i]
  } else if (args[i] === '--port' && args[i + 1]) {
    options.port = Number(args[++i])
  } else if (args[i] === '--public' && args[i + 1]) {
    options.publicDir = args[++i]
  } else if (args[i] === '--public-mount' && args[i + 1]) {
    options.publicMountPath = args[++i]
  } else if (args[i] === '-h' || args[i] === '--help') {
    printHelp()
    process.exit(0)
  }
}

switch (command) {
  case 'dev':
    let serverHandle = null
    try {
      serverHandle = await startDevServer({
        routesDir: options.routesDir,
        watch: true,
        host: options.host,
        port: options.port,
        publicDir: options.publicDir,
        publicMountPath: options.publicMountPath
      })
    } catch (e) {
      console.error(e && e.message ? e.message : e)
      process.exit(1)
    }

    function shutdown() {
      if (serverHandle && typeof serverHandle.close === 'function') {
        serverHandle.close().finally(() => process.exit(0))
        return
      }
      process.exit(0)
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
    break

  default:
    printHelp()
}
