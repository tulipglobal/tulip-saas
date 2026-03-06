// ─────────────────────────────────────────────────────────────
//  lib/logger.js — v1
//
//  Structured logging with Winston.
//  - Development: coloured, readable console output
//  - Production:  JSON lines (compatible with Datadog, Papertrail,
//                 CloudWatch, any log aggregator)
//
//  Usage:
//    const logger = require('../lib/logger')
//    logger.info('Server started', { port: 5050 })
//    logger.warn('Cache miss', { userId })
//    logger.error('DB error', { err: error.message })
// ─────────────────────────────────────────────────────────────

const winston = require('winston')

const isDev = process.env.NODE_ENV !== 'production'

const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const extras = Object.keys(meta).length
      ? ' ' + JSON.stringify(meta)
      : ''
    return `${timestamp} ${level}: ${message}${extras}`
  })
)

const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

const logger = winston.createLogger({
  level:      process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  format:     isDev ? devFormat : prodFormat,
  transports: [
    new winston.transports.Console()
  ]
})

module.exports = logger
