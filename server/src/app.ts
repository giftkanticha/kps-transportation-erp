import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import authRoutes from './routes/auth'
import aclRoutes from './routes/acl'
import resetRoutes from './routes/reset'
import dataRoutes from './routes/data'
import rpcRoutes from './routes/rpc'

const app = express()

// Allow any LAN origin by default (auth is via Bearer token, not cookies, so
// reflecting the origin is safe). Override with CORS_ORIGIN (comma-separated)
// to lock it down. When the frontend is served same-origin (recommended), CORS
// is not exercised at all.
const corsEnv = process.env.CORS_ORIGIN
app.use(cors({
  origin: corsEnv ? corsEnv.split(',').map((s) => s.trim()) : true,
  credentials: true,
}))
app.use(express.json({ limit: '5mb' }))

app.use('/api/auth', authRoutes)
app.use('/api/acl', aclRoutes)
app.use('/api/reset', resetRoutes)
app.use('/api/data', dataRoutes)
app.use('/api/rpc', rpcRoutes)

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date() }))

// Serve the built frontend (single-origin LAN/online deployment). STATIC_DIR
// points at the Vite `dist` output; when present, unmatched non-/api routes
// fall back to index.html so the SPA router can handle them.
const STATIC_DIR = process.env.STATIC_DIR || path.resolve(__dirname, '../public')
if (fs.existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR))
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(STATIC_DIR, 'index.html'))
  })
}

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err.message)
  res.status(err.status || 500).json({ success: false, error: err.message || 'Internal server error' })
})

export default app
