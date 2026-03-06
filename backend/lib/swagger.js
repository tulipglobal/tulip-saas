// ─────────────────────────────────────────────────────────────
//  lib/swagger.js — v1
//
//  OpenAPI 3.0 spec for Tulip API.
//  Serves Swagger UI at /api/docs
//  Serves raw JSON spec at /api/docs.json
// ─────────────────────────────────────────────────────────────

const swaggerJsdoc = require('swagger-jsdoc')

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title:       'Tulip Integrity Platform API',
      version:     '1.0.0',
      description: 'Blockchain-anchored audit trail with dual integrity verification. Every audit log entry is SHA-256 hashed, chained with prevHash, and anchored to Polygon.',
      contact: {
        name: 'Tulip Platform',
      },
    },
    servers: [
      { url: 'http://localhost:5050', description: 'Development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type:         'http',
          scheme:       'bearer',
          bearerFormat: 'JWT',
          description:  'JWT token from POST /api/auth/login',
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error:   { type: 'string' },
            message: { type: 'string' },
          }
        },
        AuditLog: {
          type: 'object',
          properties: {
            id:           { type: 'string', format: 'uuid' },
            action:       { type: 'string', example: 'CREATE' },
            entityType:   { type: 'string', example: 'Project' },
            entityId:     { type: 'string' },
            userId:       { type: 'string', nullable: true },
            tenantId:     { type: 'string' },
            dataHash:     { type: 'string', description: 'SHA-256 hash of this record' },
            prevHash:     { type: 'string', nullable: true, description: 'Hash of previous entry — tamper-evident chain' },
            batchId:      { type: 'string', nullable: true },
            blockchainTx: { type: 'string', nullable: true, description: 'Polygon TX hash' },
            blockNumber:  { type: 'integer', nullable: true },
            anchorStatus: { type: 'string', enum: ['pending', 'confirmed', 'failed', 'reorg_detected'], nullable: true },
            createdAt:    { type: 'string', format: 'date-time' },
          }
        },
        VerifyResult: {
          type: 'object',
          properties: {
            verified:   { type: 'boolean' },
            dataHash:   { type: 'string' },
            batchId:    { type: 'string' },
            entityType: { type: 'string' },
            entityId:   { type: 'string' },
            action:     { type: 'string' },
            recordedAt: { type: 'string', format: 'date-time' },
            integrity: {
              type: 'object',
              properties: {
                hashRecomputed: { type: 'string' },
                hashIntact:     { type: 'boolean' },
                chainIntact:    { type: 'boolean' },
              }
            },
            blockchain: {
              type: 'object',
              properties: {
                network:          { type: 'string', example: 'Polygon' },
                txHash:           { type: 'string', nullable: true },
                blockNumber:      { type: 'integer', nullable: true },
                anchorStatus:     { type: 'string' },
                onChainConfirmed: { type: 'boolean' },
              }
            }
          }
        },
        Project: {
          type: 'object',
          properties: {
            id:          { type: 'string', format: 'uuid' },
            name:        { type: 'string' },
            description: { type: 'string', nullable: true },
            budget:      { type: 'number', nullable: true },
            status:      { type: 'string', example: 'active' },
            tenantId:    { type: 'string' },
            createdAt:   { type: 'string', format: 'date-time' },
          }
        },
        Webhook: {
          type: 'object',
          properties: {
            id:          { type: 'string', format: 'uuid' },
            url:         { type: 'string', format: 'uri' },
            events:      { type: 'array', items: { type: 'string' } },
            active:      { type: 'boolean' },
            description: { type: 'string', nullable: true },
            createdAt:   { type: 'string', format: 'date-time' },
          }
        },
      }
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth',     description: 'Authentication — login, register, logout' },
      { name: 'Verify',   description: 'Public verification — no auth required' },
      { name: 'Projects', description: 'Project management' },
      { name: 'Funding',  description: 'Funding sources' },
      { name: 'Expenses', description: 'Expense tracking' },
      { name: 'Audit',    description: 'Audit log management' },
      { name: 'GDPR',     description: 'GDPR compliance — data export and erasure' },
      { name: 'Webhooks', description: 'Webhook management' },
      { name: 'System',   description: 'Health, metrics, observability' },
    ],
  },
  apis: ['./routes/*.js', './src/routes/*.js'],
}

const swaggerSpec = swaggerJsdoc(options)
module.exports = swaggerSpec
