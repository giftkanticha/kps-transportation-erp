import type { Server as IOServer } from 'socket.io'

// Holds the socket.io server instance once index.ts creates it, and lets the
// data/rpc routes broadcast change events without importing the HTTP wiring.
let io: IOServer | null = null

export function setIo(server: IOServer) {
  io = server
}

// Broadcast that a table changed so every connected client invalidates its
// React Query cache for that table. Payload is tiny on purpose.
export function emitChange(table: string) {
  io?.emit('table:changed', { table })
}
