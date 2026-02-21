"use client"

import { useState } from 'react'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!response.ok) {
        setError('Forkert adgangskode')
        setLoading(false)
        return
      }
      window.location.href = '/'
    } catch {
      setError('Kunne ikke logge ind')
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="login-card">
        <h1>Log ind</h1>
        <p className="subtitle">Indtast adgangskoden for at se opgaverne.</p>
        <form onSubmit={submit} className="login-form">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Adgangskode"
            className="login-input"
          />
          {error ? <p className="login-error">{error}</p> : null}
          <button type="submit" className="primary" disabled={loading}>
            {loading ? 'Logger ind...' : 'Log ind'}
          </button>
        </form>
      </div>
    </div>
  )
}
