/**
 * sealayer — Embeddable Verification Badge v1.0
 *
 * Usage:
 *   <script src="https://sealayer.io/embed/badge.js"></script>
 *   <div data-tulip-badge="DOCUMENT_HASH"></div>
 *
 * Options (via data attributes):
 *   data-tulip-badge="HASH"       — the SHA-256 hash to verify
 *   data-tulip-theme="light"      — "light" (default) or "dark"
 *   data-tulip-size="default"     — "compact" or "default"
 *
 * Zero dependencies. Uses Shadow DOM for style isolation.
 */
;(function () {
  'use strict'

  var API = 'https://api.sealayer.io'
  var APP = 'https://sealayer.io'

  var STYLES = [
    ':host { display: inline-block; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }',

    '.tulip-badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 8px; cursor: pointer; text-decoration: none; transition: box-shadow 0.2s, transform 0.15s; border: 1px solid; line-height: 1; }',
    '.tulip-badge:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }',
    '.tulip-badge:active { transform: translateY(0); }',

    /* Light theme */
    '.tulip-badge.light.verified { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }',
    '.tulip-badge.light.unverified { background: #f9fafb; border-color: #e5e7eb; color: #6b7280; }',
    '.tulip-badge.light.loading { background: #f9fafb; border-color: #e5e7eb; color: #9ca3af; }',

    /* Dark theme */
    '.tulip-badge.dark.verified { background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.25); color: #4ade80; }',
    '.tulip-badge.dark.unverified { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); color: rgba(255,255,255,0.4); }',
    '.tulip-badge.dark.loading { background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.08); color: rgba(255,255,255,0.3); }',

    /* Compact variant */
    '.tulip-badge.compact { padding: 5px 10px; gap: 6px; border-radius: 6px; }',
    '.tulip-badge.compact .tulip-icon { width: 14px; height: 14px; }',
    '.tulip-badge.compact .tulip-text { font-size: 11px; }',
    '.tulip-badge.compact .tulip-label { display: none; }',

    '.tulip-icon { width: 18px; height: 18px; flex-shrink: 0; }',
    '.tulip-content { display: flex; flex-direction: column; gap: 1px; }',
    '.tulip-text { font-size: 13px; font-weight: 600; white-space: nowrap; }',
    '.tulip-label { font-size: 10px; opacity: 0.7; white-space: nowrap; }',

    /* Spinner */
    '@keyframes tulip-spin { to { transform: rotate(360deg); } }',
    '.tulip-spinner { animation: tulip-spin 1s linear infinite; }',
  ].join('\n')

  var ICON_VERIFIED = '<svg class="tulip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'

  var ICON_UNVERIFIED = '<svg class="tulip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'

  var ICON_LOADING = '<svg class="tulip-icon tulip-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>'

  function createBadge(el) {
    var hash = el.getAttribute('data-tulip-badge')
    if (!hash) return

    var theme = el.getAttribute('data-tulip-theme') || 'light'
    var size = el.getAttribute('data-tulip-size') || 'default'

    var shadow = el.attachShadow({ mode: 'closed' })

    var style = document.createElement('style')
    style.textContent = STYLES
    shadow.appendChild(style)

    var link = document.createElement('a')
    link.className = 'tulip-badge ' + theme + ' loading' + (size === 'compact' ? ' compact' : '')
    link.href = APP + '/verify?hash=' + encodeURIComponent(hash)
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.title = 'Verify on sealayer'
    link.innerHTML = ICON_LOADING + '<div class="tulip-content"><span class="tulip-text">Checking\u2026</span><span class="tulip-label">sealayer</span></div>'
    shadow.appendChild(link)

    // Verify the hash
    var xhr = new XMLHttpRequest()
    xhr.open('GET', API + '/api/verify/' + encodeURIComponent(hash))
    xhr.onload = function () {
      try {
        var data = JSON.parse(xhr.responseText)
        if (data.verified) {
          link.className = 'tulip-badge ' + theme + ' verified' + (size === 'compact' ? ' compact' : '')
          link.innerHTML = ICON_VERIFIED + '<div class="tulip-content"><span class="tulip-text">Verified</span><span class="tulip-label">sealayer \u00b7 Polygon</span></div>'
        } else {
          link.className = 'tulip-badge ' + theme + ' unverified' + (size === 'compact' ? ' compact' : '')
          link.innerHTML = ICON_UNVERIFIED + '<div class="tulip-content"><span class="tulip-text">Unverified</span><span class="tulip-label">sealayer</span></div>'
        }
      } catch (e) {
        link.className = 'tulip-badge ' + theme + ' unverified' + (size === 'compact' ? ' compact' : '')
        link.innerHTML = ICON_UNVERIFIED + '<div class="tulip-content"><span class="tulip-text">Unverified</span><span class="tulip-label">sealayer</span></div>'
      }
    }
    xhr.onerror = function () {
      link.className = 'tulip-badge ' + theme + ' unverified' + (size === 'compact' ? ' compact' : '')
      link.innerHTML = ICON_UNVERIFIED + '<div class="tulip-content"><span class="tulip-text">Unverified</span><span class="tulip-label">sealayer</span></div>'
    }
    xhr.send()
  }

  function init() {
    var elements = document.querySelectorAll('[data-tulip-badge]')
    for (var i = 0; i < elements.length; i++) {
      // Skip already-initialized elements
      if (elements[i].shadowRoot || elements[i].hasAttribute('data-tulip-init')) continue
      elements[i].setAttribute('data-tulip-init', '1')
      createBadge(elements[i])
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  // Observe for dynamically added badges
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes
        for (var j = 0; j < added.length; j++) {
          if (added[j].nodeType === 1) {
            if (added[j].hasAttribute && added[j].hasAttribute('data-tulip-badge')) {
              createBadge(added[j])
            }
            var nested = added[j].querySelectorAll && added[j].querySelectorAll('[data-tulip-badge]:not([data-tulip-init])')
            if (nested) {
              for (var k = 0; k < nested.length; k++) {
                nested[k].setAttribute('data-tulip-init', '1')
                createBadge(nested[k])
              }
            }
          }
        }
      }
    }).observe(document.body, { childList: true, subtree: true })
  }
})()
