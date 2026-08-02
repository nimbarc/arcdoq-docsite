/* Docs viewer — client behaviour. Everything here is an upgrade on a floor
   that already works with JavaScript off: nav is baked, :target frames the
   rule, links resolve, provenance is decorated in CSS. */
(() => {
  const root = document.documentElement

  /* ── theme ─────────────────────────────────────────────────────────────── */
  const stored = localStorage.getItem('docs-theme')
  const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches
  const setTheme = (t) => {
    root.dataset.theme = t
    const btn = document.querySelector('.theme')
    if (btn) {
      btn.setAttribute('aria-pressed', String(t === 'dark'))
      btn.setAttribute('aria-label', `Switch to ${t === 'dark' ? 'light' : 'dark'} theme`)
    }
  }
  setTheme(stored || (prefersDark ? 'dark' : 'light'))
  document.querySelector('.theme')?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('docs-theme', next)
    setTheme(next)
  })

  /* ── case recovery on arrival ──────────────────────────────────────────── */
  // A hand-typed #AREA-012 out of a ticket must not 404 into nothing.
  // history.replaceState does NOT update the document's target element, so
  // :target would never match. location.replace is the fix.
  const h = decodeURIComponent(location.hash.slice(1))
  if (h && !document.getElementById(h) && document.getElementById(h.toLowerCase())) {
    location.replace(location.pathname + location.search + '#' + h.toLowerCase())
  }

  /* ── persistent target ─────────────────────────────────────────────────── */
  // Readers demonstrably leave a rule and come back: a rule is often qualified
  // by another one screens away, and cited again later. A two-second
  // flash is gone before a phone finishes painting.
  const frame = () => {
    const id = decodeURIComponent(location.hash.slice(1))
    document.querySelectorAll('.rule.is-target').forEach((n) => n.classList.remove('is-target'))
    const el = id && document.getElementById(id)
    if (el?.classList.contains('rule')) el.classList.add('is-target')
  }
  frame()
  addEventListener('hashchange', frame)

  /* ── permalink ─────────────────────────────────────────────────────────── */
  // Dual-MIME: the site is gated, so a bare URL pastes into Linear as an
  // opaque string and no unfurl ever fires. Only text/html gives linked text
  // that reads as the rule ID in every surface this audience uses.
  document.querySelectorAll('.rule-id').forEach((a) => {
    a.addEventListener('click', async (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
      const id = a.dataset.copy
      const url = location.href.split('#')[0] + '#' + a.getAttribute('href').slice(1)
      e.preventDefault()
      history.pushState(null, '', '#' + a.getAttribute('href').slice(1))
      frame()
      a.closest('.rule')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      try {
        if (e.altKey) { await navigator.clipboard.writeText(url); flash(a, 'URL copied'); return }
        const html = `<a href="${url}">${id}</a>`
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([`[${id}](${url})`], { type: 'text/plain' }),
        })])
        flash(a, 'Link copied')
      } catch {
        try { await navigator.clipboard.writeText(`[${id}](${url})`); flash(a, 'Link copied') } catch {}
      }
    })
  })

  let flashTimer
  function flash(el, msg) {
    let n = document.querySelector('.flash')
    if (!n) {
      n = document.createElement('div')
      n.className = 'flash'
      n.setAttribute('role', 'status')
      document.body.appendChild(n)
      Object.assign(n.style, {
        position: 'fixed', bottom: '22px', left: '50%', transform: 'translateX(-50%)',
        background: 'var(--canvas-top)', color: 'var(--ink)', zIndex: 50,
        border: '1px solid var(--line)', borderRadius: '8px',
        padding: '8px 14px', fontSize: '12.5px', boxShadow: 'var(--lift)',
      })
    }
    n.textContent = msg
    n.style.opacity = '1'
    clearTimeout(flashTimer)
    flashTimer = setTimeout(() => { n.style.opacity = '0' }, 1400)
  }

  /* ── rail scroll-spy at rule granularity ───────────────────────────────── */
  const chips = [...document.querySelectorAll('.chip')]
  if (chips.length && 'IntersectionObserver' in window) {
    const byId = new Map(chips.map((c) => [c.getAttribute('href').slice(1), c]))
    const seen = new Set()
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id))
      chips.forEach((c) => c.removeAttribute('aria-current'))
      const first = [...document.querySelectorAll('.rule')].find((r) => seen.has(r.id))
      if (first) byId.get(first.id)?.setAttribute('aria-current', 'location')
    }, { rootMargin: '-70px 0px -55% 0px' })
    document.querySelectorAll('.rule').forEach((r) => io.observe(r))
  }

  /* ── key bar: docks when the authored key scrolls away ─────────────────── */
  const key = document.querySelector('.ev-key')
  const bar = document.querySelector('.keybar')
  if (key && bar) {
    const marks = [...key.querySelectorAll('dt')].map((dt) => dt.innerHTML).join('')
    const pv = document.querySelector('.page-provenance [data-tone="pending"]')
    bar.innerHTML = marks.replace(/<dt[^>]*>/g, '').replace(/<\/dt>/g, '')
    ;[...key.querySelectorAll('div')].forEach(() => {})
    bar.innerHTML = [...key.children].map((d) => {
      const dt = d.querySelector('dt')
      return `<span>${dt.innerHTML}</span>`
    }).join('') + (pv ? `<span class="kb-state">Human-verified <b>never</b></span>` : '')
    const io = new IntersectionObserver(([e]) => {
      const off = !e.isIntersecting && e.boundingClientRect.top < 0
      bar.hidden = !off
      bar.setAttribute('aria-hidden', String(!off))
    }, { rootMargin: '-60px 0px 0px 0px' })
    io.observe(key)
  }

  /* ── search ────────────────────────────────────────────────────────────── */
  const sheet = document.createElement('div')
  sheet.className = 'sheet'
  sheet.innerHTML = `<div class="sheet-in">
    <input type="text" role="combobox" aria-expanded="false" aria-controls="sr"
      aria-autocomplete="list" placeholder="Search rules, statements, test names, paths">
    <ul class="results" id="sr" role="listbox" aria-label="Results"></ul>
    <div class="sheet-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span>
      <span><kbd>↵</kbd> open</span><span><kbd>⌥↵</kbd> copy link</span>
      <span><kbd>esc</kbd> close</span></div>
  </div>`
  document.body.appendChild(sheet)
  const input = sheet.querySelector('input')
  const list = sheet.querySelector('.results')
  let rules = []
  let sel = 0

  let examples = null
  fetch('rules.json').then((r) => r.json()).then((d) => {
    rules = d.rules
    // Examples are drawn from the corpus that is actually loaded, so the empty
    // state teaches the grammar using IDs and paths the reader will recognise.
    const first = rules[0]
    if (first) {
      const src = first.sources?.[0]?.path || ''
      examples = {
        id: first.id,
        words: first.statement.toLowerCase().replace(/[^a-z ]/g, '').split(/\s+/)
          .filter((w) => w.length > 4).slice(0, 2).join(' '),
        path: src.split('/').pop() || '',
      }
    }
  }).catch(() => {})

  const TIER = {
    confirmed: '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="2.2"/></svg>',
    unconfirmed: '<svg viewBox="0 0 10 10"><path d="M5 1.3 8.9 8.4H1.1Z"/></svg>',
    broken: '<svg viewBox="0 0 10 10"><rect x="1.4" y="1.4" width="7.2" height="7.2" rx="1.2"/></svg>',
    neutral: '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="2.2" fill="none" stroke-width="1.4"/></svg>',
  }
  const pageFile = (p) => p.replace(/\//g, '-').replace(/\.md$/, '.html')

  function search(q) {
    const t = q.trim().toLowerCase()
    if (!t) return []
    // The ID fast path: typing a rule ID is a different question from typing
    // "bounce", and the reader arrived holding the ID.
    const exact = rules.filter((r) => r.id.toLowerCase() === t ||
      r.id.toLowerCase().replace('-', '') === t.replace('-', ''))
    const rest = rules.filter((r) => !exact.includes(r) && (
      r.id.toLowerCase().includes(t) ||
      r.statement.toLowerCase().includes(t) ||
      r.tests.some((x) => x.name.toLowerCase().includes(t)) ||
      r.sources.some((x) => x.path.toLowerCase().includes(t))))
    return [...exact, ...rest].slice(0, 12)
  }

  function render(q) {
    const hits = search(q)
    sel = 0
    if (!q.trim()) {
      const bits = []
      if (examples?.id) bits.push(`a rule ID (<code>${examples.id}</code>)`)
      if (examples?.words) bits.push(`a behaviour (<code>${examples.words}</code>)`)
      if (examples?.path) bits.push(`a path (<code>${examples.path}</code>)`)
      list.innerHTML = `<li class="sheet-empty">${bits.length
        ? 'Try ' + bits.join(', ') + '.'
        : 'Search rule IDs, statements, test names and source paths.'}</li>`
      input.setAttribute('aria-expanded', 'false')
      return
    }
    if (!hits.length) {
      list.innerHTML = `<li class="sheet-empty">Nothing matches <strong>${q}</strong>.</li>`
      return
    }
    input.setAttribute('aria-expanded', 'true')
    list.innerHTML = hits.map((r, i) => `<li role="option" id="o${i}"
      aria-selected="${i === 0}"><a href="${pageFile(r.page)}#${r.anchor}">
      <span class="r-top"><span class="r-id">${r.id}</span>
      <span class="r-tier" data-tier="${r.tier}">${TIER[r.tier]}</span>
      <span class="r-meta">${r.caveats.map((c) => c.text).join(' · ') || ''}</span></span>
      <span class="r-st">${r.statement.replace(/[*_`]/g, '')}</span></a></li>`).join('')
    input.setAttribute('aria-activedescendant', 'o0')
  }

  const open = () => {
    sheet.dataset.open = ''
    input.value = ''
    render('')
    input.focus()
  }
  const close = () => { delete sheet.dataset.open; input.blur() }

  document.querySelector('.search-open')?.addEventListener('click', open)
  input.addEventListener('input', () => render(input.value))
  sheet.addEventListener('click', (e) => { if (e.target === sheet) close() })

  addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA)$/.test(e.target.tagName)
    if (!typing && (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key === 'k'))) {
      e.preventDefault(); open(); return
    }
    if (!('open' in sheet.dataset)) return
    const opts = [...list.querySelectorAll('[role="option"]')]
    if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!opts.length) return
      e.preventDefault()
      sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length
      opts.forEach((o, i) => o.setAttribute('aria-selected', String(i === sel)))
      input.setAttribute('aria-activedescendant', 'o' + sel)
      opts[sel].scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'Enter' && opts[sel]) {
      const a = opts[sel].querySelector('a')
      if (e.altKey) {
        e.preventDefault()
        const url = new URL(a.getAttribute('href'), location.href).href
        navigator.clipboard.writeText(url).then(() => flash(input, 'Link copied')).catch(() => {})
        return
      }
      e.preventDefault()
      if (e.metaKey || e.ctrlKey) window.open(a.href, '_blank')
      else location.href = a.href
    }
  })
})()
