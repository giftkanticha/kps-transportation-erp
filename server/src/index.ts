import 'dotenv/config'
import http from 'http'
import { Server as IOServer } from 'socket.io'
import app from './app'
import { setIo } from './lib/realtime'
import { AuthService } from './services/AuthService'

const PORT = parseInt(process.env.PORT || '3001')
const authService = new AuthService()

const server = http.createServer(app)

// Realtime channel. CORS is permissive here because LAN clients connect from
// their own host IPs; the JWT handshake below is the real gate.
const io = new IOServer(server, { cors: { origin: true, credentials: true } })

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token as string | undefined
    if (!token) return next(new Error('Unauthorized'))
    authService.verifyToken(token)
    next()
  } catch {
    next(new Error('Unauthorized'))
  }
})

setIo(io)

// Bind to 0.0.0.0 so other machines on the LAN can reach the server.
server.listen(PORT, '0.0.0.0', () => {
  console.log(`KPS ERP Server running on http://0.0.0.0:${PORT}`)
})
