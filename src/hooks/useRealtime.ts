// Realtime cache-invalidation hook. Backed by Supabase postgres_changes or, in
// the MySQL build, by socket.io — selected at build time. Same signature either
// way, so pages stay unchanged.
export { useRealtimeTable } from '../lib/backends'
