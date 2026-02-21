import { createClient } from 'redis'

let redisClient = null

const getRedis = async () => {
  if (!redisClient) {
    redisClient = createClient({ url: process.env.REDIS_URL })
    redisClient.on('error', () => {})
  }
  if (!redisClient.isOpen) {
    await redisClient.connect()
  }
  return redisClient
}

const toTaskId = ({ week, period, assignee, category, index }) =>
  `${week}|${period}|${assignee}|${category}|${index}`

export async function POST(request) {
  const body = await request.json()
  const items = Array.isArray(body) ? body : [body]

  if (!items.length) {
    return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 })
  }

  const now = new Date().toISOString()
  const updates = {}

  for (const item of items) {
    const { week, period, assignee, category, index, done } = item || {}
    if (!week || !period || !assignee || !category || typeof index !== 'number' || typeof done !== 'boolean') {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 })
    }
    const task = { week, period, assignee, category, index, done, updatedAt: now }
    updates[toTaskId(task)] = JSON.stringify(task)
  }

  const redis = await getRedis()
  await redis.hSet('tasks', updates)
  return new Response(JSON.stringify({ ok: true, count: items.length }), { status: 200 })
}

export async function GET() {
  const redis = await getRedis()
  const entries = (await redis.hGetAll('tasks')) || {}
  const tasks = {}

  for (const [id, value] of Object.entries(entries)) {
    try {
      tasks[id] = JSON.parse(value)
    } catch {
      // ignore bad entries
    }
  }

  return new Response(JSON.stringify({ tasks }), { status: 200 })
}
