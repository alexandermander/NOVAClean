import { NextResponse } from 'next/server'
import crypto from 'node:crypto'

const hashPassword = (value) =>
  crypto.createHash('sha256').update(value, 'utf8').digest('hex')

export async function POST(request) {
  const body = await request.json()
  const password = typeof body?.password === 'string' ? body.password : ''
  const expectedHash = process.env.SITE_PASSWORD_HASH

  if (!expectedHash) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const incomingHash = hashPassword(password)
  if (incomingHash !== expectedHash) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set({
    name: 'noba_auth',
    value: expectedHash,
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set({
    name: 'noba_auth',
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 0,
  })
  return response
}
