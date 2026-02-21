import { promises as fs } from 'node:fs'
import path from 'node:path'

const dataFile = path.join(process.cwd(), 'data', 'tasks.json')

const readStore = async () => {
  try {
    const raw = await fs.readFile(dataFile, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && parsed.tasks) return parsed
  } catch {
    // ignore
  }
  return { tasks: {} }
}

const writeStore = async (store) => {
  const payload = JSON.stringify(store, null, 2)
  await fs.writeFile(dataFile, payload, 'utf8')
}

export async function POST(request) {
  const body = await request.json()
  const items = Array.isArray(body) ? body : [body]

  if (!items.length) {
    return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 })
  }

  const store = await readStore()
  const now = new Date().toISOString()

  for (const item of items) {
    const { week, period, assignee, category, index, done } = item || {}
    if (!week || !period || !assignee || !category || typeof index !== 'number' || typeof done !== 'boolean') {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 })
    }
    const id = `${week}|${period}|${assignee}|${category}|${index}`
    store.tasks[id] = { week, period, assignee, category, index, done, updatedAt: now }
  }

  await writeStore(store)
  return new Response(JSON.stringify({ ok: true, count: items.length }), { status: 200 })
}

export async function GET() {
  const store = await readStore()
  return new Response(JSON.stringify(store), { status: 200 })
}
