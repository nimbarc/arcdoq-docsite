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

  /* ── reading the fragment ──────────────────────────────────────────────── */
  // decodeURIComponent throws URIError on any `%` that does not begin a valid
  // escape — `#50%-off` is enough. Unguarded at the top level of this IIFE it
  // took out everything below it, which is the same failure mode as the empty
  // hash and a different trigger. A fragment that will not decode is still a
  // fragment: fall back to the raw bytes rather than losing the page.
  const hashId = () => {
    const raw = location.hash.slice(1)
    try { return decodeURIComponent(raw) } catch { return raw }
  }
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)')

  /* ── case recovery on arrival ──────────────────────────────────────────── */
  // A hand-typed #AREA-012 out of a ticket must not 404 into nothing.
  // history.replaceState does NOT update the document's target element, so
  // :target would never match. location.replace is the fix.
  const h = hashId()
  if (h && !document.getElementById(h) && document.getElementById(h.toLowerCase())) {
    location.replace(location.pathname + location.search + '#' + h.toLowerCase())
  }

  /* ── persistent target ─────────────────────────────────────────────────── */
  // Readers demonstrably leave a rule and come back: a rule is often qualified
  // by another one screens away, and cited again later. A two-second
  // flash is gone before a phone finishes painting.
  // `id && getElementById(id)` yields '' on a hashless load, and '' is not
  // nullish, so `?.` does NOT short-circuit: ''.classList is undefined and the
  // whole IIFE dies here, taking search, the permalink copy, the rail spy and
  // the key bar with it. Arriving on a deep link hid it, which is the one
  // journey this design calls dominant. Ternary, not &&.
  const frame = () => {
    const id = hashId()
    document.querySelectorAll('.rule.is-target').forEach((n) => n.classList.remove('is-target'))
    const el = id ? document.getElementById(id) : null
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
      // `behavior: 'smooth'` in the options object overrides computed
      // scroll-behavior, so no CSS the reduce block can write reaches it. This
      // fires on the primary interaction of the whole design, and the scroll
      // can span a 35-rule page, so it has to be gated in script.
      a.closest('.rule')?.scrollIntoView({
        block: 'start', behavior: reduceMotion.matches ? 'auto' : 'smooth',
      })
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
        // It is faded with opacity and never removed, so without this it goes
        // on swallowing clicks at bottom-centre for the life of the page —
        // which on a phone is the full width of the measure.
        pointerEvents: 'none',
      })
    }
    n.textContent = msg
    n.style.opacity = '1'
    clearTimeout(flashTimer)
    flashTimer = setTimeout(() => { n.style.opacity = '0' }, 1400)
  }

  /* ── rail scroll-spy at rule granularity ───────────────────────────────── */
  // Scoped to the sticky rail. The in-flow disclosure carries the same chips
  // for the widths where the rail is hidden, and spying a collapsed list would
  // only fight this one for aria-current.
  const chips = [...document.querySelectorAll('.rail .chip')]
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
    // Read the BROWSER slot's live tone, not a baked marker. A host substitutes walk state into
    // these slots at serve time, so a chip derived from the build-time markup would keep announcing
    // "never walked" on a page somebody has since walked — the drift the slots exist to end. The
    // attribute is what the host rewrites, so reading it here is reading today's answer.
    const pvSlot = document.querySelector('.page-provenance [data-walk-slot="walk-browser"]')
    const pv = pvSlot && pvSlot.getAttribute('data-walk-tone') === 'never'
    bar.innerHTML = marks.replace(/<dt[^>]*>/g, '').replace(/<\/dt>/g, '')
    ;[...key.querySelectorAll('div')].forEach(() => {})
    bar.innerHTML = [...key.children].map((d) => {
      const dt = d.querySelector('dt')
      return `<span>${dt.innerHTML}</span>`
    }).join('') + (pv ? `<span class="kb-state">Walked in a browser <b>never</b></span>` : '')
    const io = new IntersectionObserver(([e]) => {
      const off = !e.isIntersecting && e.boundingClientRect.top < 0
      bar.hidden = !off
      bar.setAttribute('aria-hidden', String(!off))
    }, { rootMargin: '-60px 0px 0px 0px' })
    io.observe(key)
  }

  /* ── search: a route, so almost nothing happens here ───────────────────── */
  // What this used to be — a fixed overlay built in script, filled by writing
  // fetched corpus text into innerHTML, driven by a hand-rolled combobox — is
  // gone. Search is a page now. The whole index is baked into search.html by
  // the generator, escaped there like every other surface, so the only thing
  // left to do on the client is hide the rows that do not match.
  const searchPage = document.querySelector('.search-page')
  const input = searchPage && searchPage.querySelector('#q')
  if (searchPage && input) {
    const rows = [...searchPage.querySelectorAll('.search-index > li')]
    const count = searchPage.querySelector('.search-count')

    const apply = (raw) => {
      const q = raw.trim()
      const t = q.toLowerCase()
      let n = 0
      for (const li of rows) {
        const hit = !t || li.dataset.t.includes(t)
        li.hidden = !hit
        if (hit) n++
      }
      // textContent, never innerHTML. The query is the one string on this page
      // the reader controls, and this is the only place it is written back out.
      // The count is also the only feedback the filter gives, so it is the live
      // region: "nothing matches" has to be announced, not merely drawn.
      count.textContent = !t ? `${rows.length} entries`
        : n ? `${n} of ${rows.length} match ${q}`
        : `Nothing matches ${q}`
      // replaceState, not pushState: a query is worth having in the URL so it
      // can be pasted, but one history entry per keystroke would make Back walk
      // the query backwards a letter at a time instead of leaving the page.
      history.replaceState(null, '',
        q ? location.pathname + '?q=' + encodeURIComponent(q) : location.pathname)
    }

    // An arriving ?q= is the pasteable case, and it must filter on load rather
    // than wait for a keystroke that a linked-to reader never makes.
    const arrived = new URLSearchParams(location.search).get('q')
    if (arrived) input.value = arrived
    apply(input.value)
    input.addEventListener('input', () => apply(input.value))
  }

  // Both bindings survive the reshape because neither was ever about a dialog:
  // they go to the route, or focus the box if the route is already open.
  addEventListener('keydown', (e) => {
    if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return
    if (e.key !== '/' && !((e.metaKey || e.ctrlKey) && e.key === 'k')) return
    e.preventDefault()
    if (input) input.focus()
    else location.href = 'search.html'
  })

  /* ── recording a walk ──────────────────────────────────────────────────── */
  // The floor is real and stays untouched: the control is a plain <form> with a
  // submit button per step, so with this block deleted a walk still records — the
  // page just reloads. What this buys is not the capability, it is not losing your
  // place: marking nine steps should not reload nine times.
  //
  // Nothing here identifies the walker. A walk is recorded against the signed-in
  // account that made it, so the request carries only which step and the token.
  //
  // This is the file's only network call, and the no-fetch assertion next door was
  // narrowed to allow exactly it. That rule is about the SEARCH route — the index
  // arrives baked, so there is no request to race and no markup to construct — and
  // neither reason reaches here: this is user-initiated, so no page load can race
  // it, and it writes textContent on a button it already owns.
  //
  // Sealed in its own try/catch with its own flag. v0.1.0's client layer threw on
  // every load without a fragment and nothing said so for a whole version, because
  // everything it powers degrades quietly.
  try {
    const form = document.querySelector('form.walk')
    if (form) {
      form.addEventListener('submit', (e) => {
        const btn = e.submitter
        if (!btn || !btn.classList.contains('walk-mark')) return
        const label = btn.querySelector('[data-walk-slot="step"]')
        if (label && label.getAttribute('data-walk-tone') === 'walked') return
        // Only take over when we can send exactly what the browser would have,
        // submitter included; older engines fall through to the ordinary post.
        let body
        try { body = new FormData(form, btn) } catch { return }
        e.preventDefault()
        btn.disabled = true
        fetch(form.getAttribute('action'), {
          method: 'POST', body, headers: { accept: 'application/json' },
        })
          .then((r) => r.json())
          .then((d) => {
            if (!d || d.ok !== true) throw new Error('refused')
            btn.disabled = false
            if (label) {
              label.setAttribute('data-walk-tone', 'walked')
              label.textContent = 'Walked'
            }
            const hint = btn.querySelector('.wm-hint')
            if (hint) hint.textContent = 'just now'
          })
          .catch(() => {
            // Never strand the click: hand it back to the browser, which posts for
            // real and lands on whatever the host says — the floor, reached by
            // falling through rather than by being unavailable.
            btn.disabled = false
            form.submit()
          })
      })
      root.dataset.walk = 'ready'
    }
  } catch {
    root.dataset.walk = 'failed'
  }

  // The client layer completing is worth one observable fact. It threw on every
  // load without a fragment for the life of v0.1.0 and nothing said so, because
  // everything it powers degrades quietly by design.
  root.dataset.viewer = 'ready'
})()