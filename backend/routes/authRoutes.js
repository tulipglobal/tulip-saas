// ─────────────────────────────────────────────────────────────
//  routes/authRoutes.js — v4
//
//  Changes from v3:
//  ✔ POST /refresh endpoint added
// ─────────────────────────────────────────────────────────────

const express      = require('express')
const router       = express.Router()
const authenticate = require('../middleware/authenticate')
const { register, login, logout, me, refresh, updateProfile, updatePassword, updateLanguage, forgotPassword } = require('../controllers/authController')

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login — returns accessToken (15m) + refreshToken (7d)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Token pair issued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:  { type: string }
 *                 refreshToken: { type: string }
 *                 expiresIn:    { type: string, example: "15m" }
 *                 tokenType:    { type: string, example: "Bearer" }
 */
router.post('/login',    login)

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate refresh token — returns new token pair
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: New token pair issued, old refresh token invalidated
 *       401:
 *         description: Invalid, expired, or reused token
 */
router.post('/refresh',  refresh)

router.post('/register', register)
router.post('/forgot-password', forgotPassword)
router.post('/logout',      authenticate, logout)
router.get('/me',           authenticate, me)
router.patch('/profile',    authenticate, updateProfile)
router.patch('/password',   authenticate, updatePassword)
router.patch('/language',   authenticate, updateLanguage)

module.exports = router

// ─────────────────────────────────────────────────────────────
//  ADD TO prisma/schema.prisma — after ApiKey model:
//
//  model RefreshToken {
//    id          String    @id @default(uuid())
//    userId      String
//    user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
//    tenantId    String
//    tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
//    tokenHash   String
//    family      String
//    expiresAt   DateTime
//    revokedAt   DateTime?
//    replacedBy  String?
//    userAgent   String?
//    ip          String?
//    createdAt   DateTime  @default(now())
//
//    @@index([userId])
//    @@index([tenantId])
//    @@index([family])
//    @@index([tokenHash])
//  }
//
//  ALSO ADD to User model:    refreshTokens RefreshToken[]
//  ALSO ADD to Tenant model:  refreshTokens RefreshToken[]
// ─────────────────────────────────────────────────────────────
