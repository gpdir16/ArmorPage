// ArmorPage client router (SPA navigation)
(function() {
  'use strict'

  if (window.__ARMORPAGE_ROUTER_INITIALIZED__) {
    return
  }
  window.__ARMORPAGE_ROUTER_INITIALIZED__ = true

  let latestNavigationId = 0
  let activeController = null

  function isRouterScriptTag(scriptEl) {
    if (!scriptEl) return false
    if (scriptEl.hasAttribute('data-armorpage-router')) return true
    const src = scriptEl.getAttribute('src') || ''
    return src.includes('/_armorpage/router.js')
  }

  function updatePage(html) {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    // Sync title + meta[name]/meta[property] (keep CSS/JS links)
    document.title = doc.title
    const incomingMeta = doc.head.querySelectorAll('meta[name], meta[property]')
    incomingMeta.forEach((meta) => {
      const name = meta.getAttribute('name')
      const property = meta.getAttribute('property')
      const selector = name
        ? `meta[name="${CSS.escape(name)}"]`
        : `meta[property="${CSS.escape(property)}"]`
      const existing = document.head.querySelector(selector)
      if (existing) {
        for (const attr of meta.attributes) {
          existing.setAttribute(attr.name, attr.value)
        }
      } else {
        document.head.appendChild(meta.cloneNode(true))
      }
    })

    document.body.innerHTML = doc.body.innerHTML

    // Re-run scripts: inline by default; external only with data-armorpage-reload
    const scripts = document.body.querySelectorAll('script')
    scripts.forEach(oldScript => {
      if (isRouterScriptTag(oldScript)) {
        return
      }
      const shouldReloadExternal = oldScript.hasAttribute('data-armorpage-reload')
      if (oldScript.src && !shouldReloadExternal) {
        return
      }
      const newScript = document.createElement('script')
      for (const attr of oldScript.attributes) {
        newScript.setAttribute(attr.name, attr.value)
      }
      if (oldScript.src) {
        newScript.src = oldScript.src
      }
      if (!oldScript.src) {
        newScript.textContent = oldScript.textContent
      }
      oldScript.parentNode.replaceChild(newScript, oldScript)
    })
  }

  async function navigate(url, pushState = true) {
    const targetUrl = new URL(url, window.location.href)
    const currentUrl = new URL(window.location.href)

    const navigationId = ++latestNavigationId
    if (activeController) {
      activeController.abort()
    }
    activeController = null

    // Same-page navigation (no-op without re-fetching)
    if (pushState && targetUrl.href === currentUrl.href) {
      window.scrollTo(0, 0)
      window.dispatchEvent(new CustomEvent('armorpage:navigate', { detail: { url: targetUrl.href } }))
      return
    }

    activeController = new AbortController()

    try {
      const response = await fetch(targetUrl.href, { signal: activeController.signal })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const html = await response.text()

      // Only apply the latest navigation
      if (navigationId !== latestNavigationId) {
        return
      }

      if (pushState) {
        history.pushState(null, '', targetUrl.href)
      }

      updatePage(html)
      window.scrollTo(0, 0)

      // Emit custom event
      window.dispatchEvent(new CustomEvent('armorpage:navigate', { detail: { url: targetUrl.href } }))
    } catch (e) {
      if (e && (e.name === 'AbortError' || e.code === 20)) {
        return
      }
      console.error('Navigation error:', e)
      window.location.href = targetUrl.href
    }
  }

  function shouldIntercept(link) {
    if (link.origin !== window.location.origin) {
      return false
    }
    if (link.target && link.target !== '_self') {
      return false
    }
    if (link.hasAttribute('data-no-spa')) {
      return false
    }
    if (link.hasAttribute('download')) {
      return false
    }
    if (link.pathname === window.location.pathname && link.hash) {
      return false
    }

    return true
  }

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented) return
    if (e.button !== 0) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

    const link = e.target.closest('a')
    if (!link) return

    if (shouldIntercept(link)) {
      e.preventDefault()
      navigate(link.href)
    }
  })

  window.addEventListener('popstate', () => {
    navigate(window.location.href, false)
  })

  window.ArmorPage = {
    navigate,
    reload: () => navigate(window.location.href, false)
  }
})()
