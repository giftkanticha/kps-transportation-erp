import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth'
import aclRoutes from './routes/acl'
import resetRoutes from './routes/reset'

const app = express()

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], credentials: true }))
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/acl', aclRoutes)
app.use('/api/reset', resetRoutes)

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date() }))

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err.message)
  res.status(err.status || 500).json({ success: false, error: err.message || 'Internal server error' })
})

export default app
