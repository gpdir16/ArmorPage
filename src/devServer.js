import path from 'path'

import { armorpage, serveRouter } from './middleware.js'

export async function startDevServer(options = {}) {
  const port = Number(options.port || 3000)
  const host = options.host || 'localhost'
  const routesDir = options.routesDir || './routes'
  const watch = options.watch !== false

  const publicDir = options.publicDir || './public'
  const publicMountPath = options.publicMountPath || '/public'

  let express
  try {
    express = (await import('express')).default
  } catch (e) {
    const message = [
      '[armorpage] dev server requires express to be installed.',
      'Install it in your project: npm i express',
      `Original error: ${e && e.message ? e.message : String(e)}`
    ].join('\n')
    const err = new Error(message)
    err.cause = e
    throw err
  }

  const app = express()

  const publicAbs = path.resolve(publicDir)
  app.use(publicMountPath, express.static(publicAbs))

  app.use(serveRouter())
  app.use(
    armorpage({
      routesDir,
      watch
    })
  )

  app.get('/_armorpage/health', (req, res) => {
    res.json({ ok: true })
  })

  const server = app.listen(port, host, () => {
    console.log(`http://${host}:${port}`)
  })

  return {
    app,
    server,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      })
  }
}
