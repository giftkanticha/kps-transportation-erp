// Data access layer. The actual implementation is chosen at build time by the
// backend selector (VITE_DATA_BACKEND): the original Supabase client, or the
// self-hosted MySQL REST API. All call sites import from here unchanged.
export { listAll, getOne, insertOne, updateOne, deleteOne, callRpc } from './backends'
