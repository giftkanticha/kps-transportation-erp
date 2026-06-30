// Backend selector. Picks the data implementation at build time based on
// VITE_DATA_BACKEND (default 'supabase'). The Supabase path is unchanged from
// the original app; 'mysql' routes the same calls through the REST API.
import { ACTIVE_BACKEND } from './types'
import * as supabaseCrud from './supabase/crud'
import * as mysqlCrud from './mysql/crud'
import { useRealtimeTable as supabaseRealtime } from './supabase/realtime'
import { useRealtimeTable as mysqlRealtime } from './mysql/realtime'

const crud = ACTIVE_BACKEND === 'mysql' ? mysqlCrud : supabaseCrud

export const listAll   = crud.listAll
export const getOne    = crud.getOne
export const insertOne = crud.insertOne
export const updateOne = crud.updateOne
export const deleteOne = crud.deleteOne
export const callRpc   = crud.callRpc

export const useRealtimeTable = ACTIVE_BACKEND === 'mysql' ? mysqlRealtime : supabaseRealtime

export { ACTIVE_BACKEND } from './types'
