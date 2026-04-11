import { createClient } from '@supabase/supabase-js'

/**
 * Same bucket as jubba-backend (`src/config/supabase.js`, `telegramParser.js`, `uploadService.js`).
 */
export const SUPABASE_PRODUCTS_BUCKET = 'products'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && anonKey ? createClient(url, anonKey) : null

/**
 * List all items under `prefix`, paginated (Supabase list max 1000 per call).
 */
async function listAll(client, bucketName, prefix) {
  const out = []
  let offset = 0
  const limit = 1000
  while (true) {
    const { data: items, error } = await client.storage.from(bucketName).list(prefix, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw error
    if (!items?.length) break
    out.push(...items)
    if (items.length < limit) break
    offset += limit
  }
  return out
}

/**
 * Recursively delete all files in the bucket (folders: entries with `id === null` per Supabase Storage API).
 */
export async function deleteAllFilesInProductsBucket() {
  if (!supabase) return

  async function walk(prefix) {
    const items = await listAll(supabase, SUPABASE_PRODUCTS_BUCKET, prefix)
    const filePaths = []

    for (const item of items) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id === null) {
        await walk(path)
      } else {
        filePaths.push(path)
      }
    }

    if (filePaths.length) {
      for (let i = 0; i < filePaths.length; i += 100) {
        const batch = filePaths.slice(i, i + 100)
        const { error: rmErr } = await supabase.storage.from(SUPABASE_PRODUCTS_BUCKET).remove(batch)
        if (rmErr) throw rmErr
      }
    }
  }

  await walk('')
}
