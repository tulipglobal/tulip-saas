// ─────────────────────────────────────────────────────────────
//  services/siemService.js — v1
//
//  Structured event emitter for SIEM integration.
//  Configurable via environment variables — zero code changes
//  needed to switch targets.
//
//  Supported adapters:
//    splunk    — Splunk HEC (HTTP Event Collector)
//    elastic   — Elasticsearch / Elastic SIEM
//    sentinel  — Microsoft Sentinel (Log Analytics)
//    webhook   — Generic HTTPS webhook (any SIEM)
//    console   — stdout JSON (default / dev / testing)
//
//  Configure via .env:
//    SIEM_ADAPTER=splunk
//    SIEM_SPLUNK_URL=https://splunk.example.com:8088/services/collector
//    SIEM_SPLUNK_TOKEN=your-hec-token
//
//  Events emitted:
//    auth.login_success     auth.login_failed     auth.logout
//    audit.created          anchor.confirmed      anchor.failed
//    gdpr.export            gdpr.erasure
//    permission.denied      rate_limit.exceeded
//    api_key.created        api_key.revoked
// ─────────────────────────────────────────────────────────────

const logger = require('../lib/logger')

const ADAPTER = (process.env.SIEM_ADAPTER || 'console').toLowerCase()

// ── Canonical event structure ─────────────────────────────────
function buildEvent(eventType, data, req = null) {
  return {
    // Required fields for all SIEM platforms
    timestamp:      new Date().toISOString(),
    event_type:     eventType,
    source:         'tulip-platform',
    source_version: '1.0.0',
    environment:    process.env.NODE_ENV || 'development',

    // Identity context
    tenant_id:   data.tenantId   || null,
    user_id:     data.userId     || null,
    key_id:      data.keyId      || null,
    auth_method: data.authMethod || null,

    // Request context (when available)
    ip:         req?.ip          || data.ip   || null,
    user_agent: req?.headers?.['user-agent'] || null,
    request_id: req?.headers?.['x-request-id'] || null,

    // Event-specific payload
    ...data,

    // Remove duplicated top-level fields from payload
    tenantId:   undefined,
    userId:     undefined,
    authMethod: undefined,
  }
}

// ── Splunk HEC adapter ────────────────────────────────────────
async function emitSplunk(event) {
  const url   = process.env.SIEM_SPLUNK_URL
  const token = process.env.SIEM_SPLUNK_TOKEN

  if (!url || !token) {
    logger.warn('[siem] Splunk adapter configured but SIEM_SPLUNK_URL or SIEM_SPLUNK_TOKEN missing')
    return
  }

  await fetch(url, {
    method:  'POST',
    headers: {
      'Authorization': `Splunk ${token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      time:       Math.floor(Date.now() / 1000),
      host:       process.env.HOSTNAME || 'tulip-api',
      source:     'tulip',
      sourcetype: '_json',
      index:      process.env.SIEM_SPLUNK_INDEX || 'tulip_events',
      event,
    }),
  })
}

// ── Elasticsearch adapter ─────────────────────────────────────
async function emitElastic(event) {
  const url    = process.env.SIEM_ELASTIC_URL
  const apiKey = process.env.SIEM_ELASTIC_API_KEY
  const index  = process.env.SIEM_ELASTIC_INDEX || 'tulip-events'

  if (!url) {
    logger.warn('[siem] Elastic adapter configured but SIEM_ELASTIC_URL missing')
    return
  }

  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `ApiKey ${apiKey}`

  await fetch(`${url}/${index}/_doc`, {
    method: 'POST',
    headers,
    body:   JSON.stringify({
      '@timestamp': event.timestamp,
      ...event,
    }),
  })
}

// ── Microsoft Sentinel (Log Analytics) adapter ────────────────
async function emitSentinel(event) {
  const workspaceId  = process.env.SIEM_SENTINEL_WORKSPACE_ID
  const sharedKey    = process.env.SIEM_SENTINEL_SHARED_KEY
  const logType      = process.env.SIEM_SENTINEL_LOG_TYPE || 'TulipEvents'

  if (!workspaceId || !sharedKey) {
    logger.warn('[siem] Sentinel adapter configured but workspace ID or shared key missing')
    return
  }

  const body        = JSON.stringify([event])
  const contentType = 'application/json'
  const date        = new Date().toUTCString()
  const contentLen  = Buffer.byteLength(body, 'utf8')

  // Build HMAC-SHA256 signature
  const crypto      = require('crypto')
  const stringToSign = `POST\n${contentLen}\n${contentType}\nx-ms-date:${date}\n/api/logs`
  const key         = Buffer.from(sharedKey, 'base64')
  const signature   = crypto.createHmac('sha256', key).update(stringToSign).digest('base64')
  const auth        = `SharedKey ${workspaceId}:${signature}`

  const url = `https://${workspaceId}.ods.opinsights.azure.com/api/logs?api-version=2016-04-01`

  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type':  contentType,
      'Authorization': auth,
      'Log-Type':      logType,
      'x-ms-date':     date,
    },
    body,
  })
}

// ── Generic HTTPS webhook adapter ────────────────────────────
async function emitWebhook(event) {
  const url    = process.env.SIEM_WEBHOOK_URL
  const secret = process.env.SIEM_WEBHOOK_SECRET

  if (!url) {
    logger.warn('[siem] Webhook adapter configured but SIEM_WEBHOOK_URL missing')
    return
  }

  const headers = { 'Content-Type': 'application/json' }

  if (secret) {
    const crypto    = require('crypto')
    const body      = JSON.stringify(event)
    const signature = crypto.createHmac('sha256', secret).update(body).digest('hex')
    headers['X-Tulip-Signature'] = `sha256=${signature}`
  }

  await fetch(url, {
    method:  'POST',
    headers,
    body:    JSON.stringify(event),
  })
}

// ── Console adapter (default / dev) ──────────────────────────
function emitConsole(event) {
  logger.info(`[siem] ${event.event_type}`, {
    tenant_id:  event.tenant_id,
    user_id:    event.user_id,
    ip:         event.ip,
    event_type: event.event_type,
  })
}

// ── Main emit function ────────────────────────────────────────
async function emit(eventType, data, req = null) {
  try {
    const event = buildEvent(eventType, data, req)

    switch (ADAPTER) {
      case 'splunk':   await emitSplunk(event);   break
      case 'elastic':  await emitElastic(event);  break
      case 'sentinel': await emitSentinel(event); break
      case 'webhook':  await emitWebhook(event);  break
      default:         emitConsole(event);         break
    }
  } catch (err) {
    // SIEM failures must NEVER affect the main request
    logger.error('[siem] Emit failed', { adapter: ADAPTER, event: eventType, error: err.message })
  }
}

module.exports = { emit }
