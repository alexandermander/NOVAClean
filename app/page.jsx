"use client"

import { useMemo, useState, useEffect } from 'react'
import data from './opgaver.json'

const MONTH_GROUPS_KEY = 'opgaver:monthlyGroups'
const MONTH_ASSIGNMENT_KEY = 'opgaver:monthlyAssignment'

const dayNames = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']

const addDays = (date, days) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const getIsoWeekInfo = (date) => {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((target - yearStart) / 86400000 + 1) / 7)
  const weekYear = target.getUTCFullYear()
  const monday = addDays(new Date(target), -3)
  const sunday = addDays(monday, 6)
  return { week: weekNo, year: weekYear, start: monday, end: sunday }
}

const rotateArray = (items, amount) => {
  if (!items.length) return []
  const step = ((amount % items.length) + items.length) % items.length
  return items.slice(step).concat(items.slice(0, step))
}

const storeToDoneMap = (store) => {
  if (!store || typeof store !== 'object' || !store.tasks) return {}
  const map = {}
  Object.values(store.tasks).forEach((task) => {
    if (!task) return
    const { week, period, assignee, category, index, done } = task
    if (!week || !period || !assignee || !category || typeof index !== 'number') return
    const id = `${week}|${period}|${assignee}|${category}|${index}`
    map[id] = Boolean(done)
  })
  return map
}

const loadMonthlyGroups = () => {
  if (typeof window === 'undefined') return null
  try {
    const stored = JSON.parse(localStorage.getItem(MONTH_GROUPS_KEY) || 'null')
    if (stored && Array.isArray(stored.groupA) && Array.isArray(stored.groupB)) {
      return stored
    }
  } catch {
    // ignore
  }
  return null
}

const loadMonthlyAssignment = () => {
  if (typeof window === 'undefined') return 'overflader-on-groupB'
  const stored = localStorage.getItem(MONTH_ASSIGNMENT_KEY)
  return stored === 'overflader-on-groupA' ? 'overflader-on-groupA' : 'overflader-on-groupB'
}

const shuffleArray = (items) => {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

const postTaskUpdate = (payload) => {
  fetch('/api/task', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {})
}

const postTaskBatch = (items) => {
  if (!items.length) return
  postTaskUpdate(items)
}

export default function Home() {
  const [isClient, setIsClient] = useState(false)
  const [done, setDone] = useState({})
  const [monthlyGroups, setMonthlyGroups] = useState(() => loadMonthlyGroups())
  const [monthlyAssignment, setMonthlyAssignment] = useState(() => loadMonthlyAssignment())

  useEffect(() => {
    setIsClient(true)
    try {
      localStorage.removeItem('opgaver:done')
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    let active = true
    const fetchState = async () => {
      try {
        const response = await fetch('/api/task', { cache: 'no-store' })
        if (!response.ok) return
        const store = await response.json()
        if (!active) return
        const serverDone = storeToDoneMap(store)
        setDone(serverDone)
      } catch {
        // ignore
      }
    }

    fetchState()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (monthlyGroups) {
      localStorage.setItem(MONTH_GROUPS_KEY, JSON.stringify(monthlyGroups))
    }
  }, [monthlyGroups])

  useEffect(() => {
    localStorage.setItem(MONTH_ASSIGNMENT_KEY, monthlyAssignment)
  }, [monthlyAssignment])

  const today = useMemo(() => new Date(), [])
  const weekDate = useMemo(() => today, [today])
  const weekInfo = useMemo(() => getIsoWeekInfo(weekDate), [weekDate])

  const weekKey = `${weekInfo.year}-W${String(weekInfo.week).padStart(2, '0')}`

  const persons = data.personer
  const categories = Object.keys(data.ugentlig)
  const startOfIsoWeek = (date) => {
    const next = new Date(date)
    const day = next.getDay()
    const diff = (day === 0 ? -6 : 1) - day
    next.setDate(next.getDate() + diff)
    next.setHours(0, 0, 0, 0)
    return next
  }

  const baseDate = data.base_date ? new Date(data.base_date) : today
  const baseMonday = startOfIsoWeek(Number.isNaN(baseDate.getTime()) ? today : baseDate)
  const currentMonday = startOfIsoWeek(today)
  const weeksBetween = Math.floor((currentMonday - baseMonday) / (7 * 24 * 60 * 60 * 1000))
  const rotationSeed = weeksBetween
  const rotatedPersons = rotateArray(persons, rotationSeed)
  const joker = rotatedPersons[categories.length] || 'JOKER'

  const assignments = useMemo(() => {
    const mapping = new Map()
    categories.forEach((category, index) => {
      const person = rotatedPersons[index]
      if (!mapping.has(person)) mapping.set(person, [])
      mapping.get(person).push(category)
    })
    if (!mapping.has(joker)) mapping.set(joker, [])
    return mapping
  }, [categories, rotatedPersons, joker])

  const personsOrdered = [...rotatedPersons]

  const toggleTask = (period, person, category, index) => {
    const id = `${weekKey}|${period}|${person}|${category}|${index}`
    setDone((prev) => {
      const nextValue = !prev[id]
      postTaskUpdate({
        week: weekKey,
        period,
        assignee: person,
        category,
        index,
        done: nextValue,
      })
      return { ...prev, [id]: nextValue }
    })
  }

  const setPersonDone = (period, person, value) => {
    const personCategories = assignments.get(person) || []
    setDone((prev) => {
      const next = { ...prev }
      const updates = []
      personCategories.forEach((category) => {
        const tasks = data[period][category] || []
        tasks.forEach((_, index) => {
          const id = `${weekKey}|${period}|${person}|${category}|${index}`
          next[id] = value
          updates.push({
            week: weekKey,
            period,
            assignee: person,
            category,
            index,
            done: value,
          })
        })
      })
      postTaskBatch(updates)
      return next
    })
  }

  const countTasks = (period) => {
    let total = 0
    let completed = 0
    categories.forEach((category) => {
      const tasks = data[period][category] || []
      total += tasks.length
      tasks.forEach((_, index) => {
        const id = `${weekKey}|${period}|${rotatedPersons[categories.indexOf(category)]}|${category}|${index}`
        if (done[id]) completed += 1
      })
    })
    return { total, completed }
  }

  const weeklyCount = countTasks('ugentlig')
  const getDefaultGroups = () => {
    if (persons.length >= 4) {
      return { groupA: ['NA', 'OL'].filter((p) => persons.includes(p)), groupB: ['BA', 'AL'].filter((p) => persons.includes(p)) }
    }
    const shuffled = shuffleArray(persons)
    const mid = Math.ceil(shuffled.length / 2)
    return { groupA: shuffled.slice(0, mid), groupB: shuffled.slice(mid) }
  }

  useEffect(() => {
    if (!monthlyGroups) {
      const shuffled = shuffleArray(persons)
      const mid = Math.ceil(shuffled.length / 2)
      setMonthlyGroups({ groupA: shuffled.slice(0, mid), groupB: shuffled.slice(mid) })
    }
  }, [monthlyGroups, persons])

  const activeMonthlyGroups = monthlyGroups || getDefaultGroups()

  const countMonthly = () => {
    let total = 0
    let completed = 0
    const kitchenTasks = data.månedlig.køkken || []
    const overfladerTasks = data.månedlig.overflader || []

    const kitchenGroup = monthlyAssignment === 'overflader-on-groupA' ? activeMonthlyGroups.groupB : activeMonthlyGroups.groupA
    const overfladerGroup = monthlyAssignment === 'overflader-on-groupA' ? activeMonthlyGroups.groupA : activeMonthlyGroups.groupB

    const kitchenGroupKey = kitchenGroup.join('+') || 'gruppeA'
    const overfladerGroupKey = overfladerGroup.join('+') || 'gruppeB'

    total += kitchenTasks.length
    kitchenTasks.forEach((_, index) => {
      const id = `${weekKey}|månedlig|${kitchenGroupKey}|køkken|${index}`
      if (done[id]) completed += 1
    })

    total += overfladerTasks.length
    overfladerTasks.forEach((_, index) => {
      const id = `${weekKey}|månedlig|${overfladerGroupKey}|overflader|${index}`
      if (done[id]) completed += 1
    })

    return { total, completed }
  }

  const monthlyCount = countMonthly()

  const formatDate = (date) => {
    const dayName = dayNames[date.getDay()]
    return `${dayName} ${date.getDate()}/${date.getMonth() + 1}`
  }

  const renderPerson = (period, person) => {
    const assigned = assignments.get(person) || []
    const isJoker = person === joker

    const personAllDone = assigned.length
      ? assigned.every((category) => {
          const tasks = data[period][category] || []
          return tasks.length
            ? tasks.every((_, index) => done[`${weekKey}|${period}|${person}|${category}|${index}`])
            : true
        })
      : false

    return (
      <article key={`${period}-${person}`} className={`group ${isJoker ? 'group--joker' : ''}`}>
        <div className="group__header">
          <div className="group__person">
            <span className="person-chip">{person}</span>
            {isJoker ? <span className="badge">Joker</span> : <span className="badge">{period}</span>}
          </div>
          {!isJoker && (
            <div className="group__header-right">
              <button
                type="button"
                className={`circle-button ${personAllDone ? 'is-done' : ''}`}
                onClick={() => setPersonDone(period, person, !personAllDone)}
                aria-label={`Marker alle opgaver for ${person} som færdige`}
                title={`Marker alle opgaver for ${person} som færdige`}
              >
                {personAllDone ? '✓' : ''}
              </button>
            </div>
          )}
        </div>
        {assigned.length === 0 ? (
          <div className="empty empty--small">Ingen opgaver denne uge.</div>
        ) : (
          assigned.map((category) => {
            const tasks = data[period][category] || []
            if (!tasks.length) {
              return (
                <div key={`${period}-${person}-${category}`}>
                  <div className="category-header">
                    <div className="task-category">{category}</div>
                  </div>
                  <div className="empty empty--small">Ingen opgaver i {category}.</div>
                </div>
              )
            }

            return (
              <div key={`${period}-${person}-${category}`}>
                <div className="category-header">
                  <div className="task-category">{category}</div>
                </div>
                <ul className="task-list">
                  {tasks.map((task, index) => {
                    const id = `${weekKey}|${period}|${person}|${category}|${index}`
                    const isDone = Boolean(done[id])
                    return (
                      <li
                        key={id}
                        className={`task-item ${isDone ? 'completed' : ''}`}
                        onClick={() => toggleTask(period, person, category, index)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            toggleTask(period, person, category, index)
                          }
                        }}
                      >
                        <span className="task-label">{task}</span>
                        <span className="task-icon" aria-hidden="true">
                          ✓
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })
        )}
      </article>
    )
  }

  const renderMonthlyGroup = (groupKey, members, categoryLabel) => {
    const tasks = data.månedlig[categoryLabel] || []
    const groupId = members.join('+') || groupKey
    const groupAllDone = tasks.length
      ? tasks.every((_, index) => done[`${weekKey}|månedlig|${groupId}|${categoryLabel}|${index}`])
      : false

    return (
      <article key={`månedlig-${groupKey}`} className="group">
        <div className="group__header">
          <div className="group__person">
            <span className="person-chip">{members.join(' + ')}</span>
            <span className="badge">månedlig</span>
          </div>
          <div className="group__header-right">
            <button
              type="button"
              className={`circle-button ${groupAllDone ? 'is-done' : ''}`}
              onClick={() => {
                const nextValue = !groupAllDone
                setDone((prev) => {
                  const next = { ...prev }
                  const updates = []
                  tasks.forEach((_, index) => {
                    const id = `${weekKey}|månedlig|${groupId}|${categoryLabel}|${index}`
                    next[id] = nextValue
                    updates.push({
                      week: weekKey,
                      period: 'månedlig',
                      assignee: groupId,
                      category: categoryLabel,
                      index,
                      done: nextValue,
                    })
                  })
                  postTaskBatch(updates)
                  return next
                })
              }}
              aria-label={`Marker alle månedlige opgaver for ${members.join(' og ')} som færdige`}
              title={`Marker alle månedlige opgaver for ${members.join(' og ')} som færdige`}
            >
              {groupAllDone ? '✓' : ''}
            </button>
          </div>
        </div>
        {!tasks.length ? (
          <div className="empty empty--small">Ingen opgaver i {categoryLabel}.</div>
        ) : (
          <div>
            <div className="category-header">
              <div className="task-category">{categoryLabel}</div>
            </div>
            <ul className="task-list">
              {tasks.map((task, index) => {
                const id = `${weekKey}|månedlig|${groupId}|${categoryLabel}|${index}`
                const isDone = Boolean(done[id])
                return (
                  <li
                    key={id}
                    className={`task-item ${isDone ? 'completed' : ''}`}
                    onClick={() => toggleTask('månedlig', groupId, categoryLabel, index)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        toggleTask('månedlig', groupId, categoryLabel, index)
                      }
                    }}
                  >
                    <span className="task-label">{task}</span>
                    <span className="task-icon" aria-hidden="true">
                      ✓
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </article>
    )
  }

  const swapMonthlyAssignment = () => {
    setMonthlyAssignment((prev) =>
      prev === 'overflader-on-groupA' ? 'overflader-on-groupB' : 'overflader-on-groupA'
    )
  }

  if (!isClient) {
    return (
      <div className="page">
        <header className="hero">
          <div>
            <p className="eyebrow">Opgaveboard</p>
            <h1>Ugentlige og månedlige opgaver</h1>
          </div>
        </header>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Opgaveboard</p>
          <h1>Ugentlige og månedlige opgaver</h1>
          <p className="subtitle">
            Hold styr på hvem der har køkken, overflader og badeværelse. Hver uge flytter
            personerne én plads til højre, og jokeren har fri.
          </p>
        </div>
        <div className="hero__actions">
          <div className="hero__controls" />
          <div className="week-meta">
            <span className="pill">Uge {weekInfo.week}, {weekInfo.year}</span>
            <span className="timestamp">
              {formatDate(weekInfo.start)} - {formatDate(weekInfo.end)}
            </span>
          </div>
          <span className="notice">Sidst gemt lokalt i browseren.</span>
        </div>
      </header>

      <section className="board">
        <div className="lane">
          <div className="lane__header">
            <div>
              <h2 className="lane__title">Ugentlig</h2>
              <p className="lane__subtitle">Gennemgå alle ugentlige opgaver.</p>
            </div>
            <span className="pill">
              {weeklyCount.completed} / {weeklyCount.total} færdige
            </span>
          </div>
          <div className="group-grid">
            {personsOrdered.map((person) => renderPerson('ugentlig', person))}
          </div>
        </div>

        <div className="lane">
          <div className="lane__header">
            <div>
              <h2 className="lane__title">Månedlig</h2>
              <p className="lane__subtitle">Ekstra opgaver der kun skal klares én gang om måneden.</p>
            </div>
            <div className="board__actions">
              <button className="secondary" onClick={swapMonthlyAssignment}>
                Skift opgaver
              </button>
              <span className="pill">
                {monthlyCount.completed} / {monthlyCount.total} færdige
              </span>
            </div>
          </div>
          <div className="group-grid">
            {(() => {
              const groupA = activeMonthlyGroups.groupA
              const groupB = activeMonthlyGroups.groupB
              const overfladerOnGroupA = monthlyAssignment === 'overflader-on-groupA'

              return (
                <>
                  {renderMonthlyGroup(
                    'groupA',
                    groupA,
                    overfladerOnGroupA ? 'overflader' : 'køkken'
                  )}
                  {renderMonthlyGroup(
                    'groupB',
                    groupB,
                    overfladerOnGroupA ? 'køkken' : 'overflader'
                  )}
                </>
              )
            })()}
          </div>
        </div>
      </section>
    </div>
  )
}




