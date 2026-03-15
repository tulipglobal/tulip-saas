// ─────────────────────────────────────────────────────────────
//  lib/socketio.js — Socket.IO server for real-time messaging
// ─────────────────────────────────────────────────────────────

const { Server } = require('socket.io')
const prisma = require('./client')

let io = null
const onlineUsers = new Map()

function initSocketIO(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: [
        'https://app.sealayer.io',
        'https://donor.sealayer.io',
        'http://localhost:3000',
        'http://localhost:4000'
      ],
      credentials: true
    }
  })

  io.on('connection', (socket) => {

    socket.on('authenticate', (data) => {
      onlineUsers.set(data.userId, { socketId: socket.id, ...data })
      socket.userId = data.userId
      socket.userType = data.userType
      socket.senderName = data.name
      socket.tenantId = data.tenantId
      socket.donorOrgId = data.donorOrgId

      const room = `${data.tenantId}:${data.donorOrgId}`
      socket.join(room)

      socket.to(room).emit('user_online', {
        userId: data.userId,
        name: data.name,
        userType: data.userType
      })
    })

    socket.on('send_message', async (data) => {
      try {
        const rows = await prisma.$queryRawUnsafe(
          `INSERT INTO "Message" ("conversationId", "senderType", "senderId", "senderName", content, "messageType", "fileUrl", "fileName", "fileSize")
           VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          data.conversationId, socket.userType, socket.userId, socket.senderName || 'Unknown',
          data.content || null, data.messageType || 'TEXT',
          data.fileUrl || null, data.fileName || null, data.fileSize || null
        )
        const message = rows[0]

        await prisma.$executeRawUnsafe(
          `UPDATE "Conversation" SET "lastMessageAt" = NOW(), "updatedAt" = NOW() WHERE id = $1::uuid`,
          data.conversationId
        )

        const room = `${socket.tenantId}:${socket.donorOrgId}`
        io.to(room).emit('new_message', message)
      } catch (err) {
        console.error('send_message error:', err.message)
        socket.emit('message_error', { error: 'Failed to send message' })
      }
    })

    socket.on('mark_read', async (data) => {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "Message" SET "isRead" = true, "readAt" = NOW()
           WHERE "conversationId" = $1::uuid AND "senderId" != $2 AND "isRead" = false`,
          data.conversationId, socket.userId
        )
        const room = `${socket.tenantId}:${socket.donorOrgId}`
        socket.to(room).emit('messages_read', {
          conversationId: data.conversationId,
          readBy: socket.userId
        })
      } catch (err) {
        console.error('mark_read error:', err.message)
      }
    })

    // WebRTC call signalling
    socket.on('call_initiate', async (data) => {
      try {
        const room = `${socket.tenantId}:${socket.donorOrgId}`
        const rows = await prisma.$queryRawUnsafe(
          `INSERT INTO "CallSession" ("conversationId", "callerId", "callerType", "callerName")
           VALUES ($1::uuid, $2, $3, $4)
           RETURNING *`,
          data.conversationId, socket.userId, socket.userType, data.callerName || socket.senderName
        )
        const session = rows[0]

        const roomSockets = await io.in(room).fetchSockets()
        const othersOnline = roomSockets.filter(s => s.userId !== socket.userId)

        if (othersOnline.length === 0) {
          await prisma.$executeRawUnsafe(
            `UPDATE "CallSession" SET status = 'MISSED', "endedAt" = NOW() WHERE id = $1::uuid`, session.id
          )
          await prisma.$queryRawUnsafe(
            `INSERT INTO "Message" ("conversationId", "senderType", "senderId", "senderName", "messageType", "callStatus", "callDuration")
             VALUES ($1::uuid, $2, $3, $4, 'CALL', 'MISSED', 0)`,
            data.conversationId, socket.userType, socket.userId, data.callerName || socket.senderName
          )
          socket.emit('call_missed', { reason: 'User is offline' })
        } else {
          socket.to(room).emit('call_incoming', {
            sessionId: session.id,
            callerId: socket.userId,
            callerName: data.callerName || socket.senderName,
            callerType: socket.userType
          })
          socket.emit('call_ringing', { sessionId: session.id })
        }
      } catch (err) {
        console.error('call_initiate error:', err.message)
      }
    })

    socket.on('call_accept', async (data) => {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "CallSession" SET status = 'ACTIVE', "startedAt" = NOW(), "receiverId" = $1, "receiverType" = $2 WHERE id = $3::uuid`,
          socket.userId, socket.userType, data.sessionId
        )
        const room = `${socket.tenantId}:${socket.donorOrgId}`
        io.to(room).emit('call_accepted', { sessionId: data.sessionId })
      } catch (err) {
        console.error('call_accept error:', err.message)
      }
    })

    socket.on('call_decline', async (data) => {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "CallSession" SET status = 'DECLINED', "endedAt" = NOW() WHERE id = $1::uuid`, data.sessionId
        )
        const room = `${socket.tenantId}:${socket.donorOrgId}`
        io.to(room).emit('call_declined', { sessionId: data.sessionId })
      } catch (err) {
        console.error('call_decline error:', err.message)
      }
    })

    socket.on('call_end', async (data) => {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "CallSession" SET status = 'ENDED', "endedAt" = NOW() WHERE id = $1::uuid`, data.sessionId
        )
        await prisma.$queryRawUnsafe(
          `INSERT INTO "Message" ("conversationId", "senderType", "senderId", "senderName", "messageType", "callStatus", "callDuration")
           VALUES ($1::uuid, $2, $3, $4, 'CALL', 'COMPLETED', $5)`,
          data.conversationId, socket.userType, socket.userId, socket.senderName || 'Unknown', data.duration || 0
        )
        const room = `${socket.tenantId}:${socket.donorOrgId}`
        io.to(room).emit('call_ended', { sessionId: data.sessionId, duration: data.duration })
      } catch (err) {
        console.error('call_end error:', err.message)
      }
    })

    // WebRTC peer connection signalling
    socket.on('webrtc_offer', (data) => {
      const room = `${socket.tenantId}:${socket.donorOrgId}`
      socket.to(room).emit('webrtc_offer', data)
    })
    socket.on('webrtc_answer', (data) => {
      const room = `${socket.tenantId}:${socket.donorOrgId}`
      socket.to(room).emit('webrtc_answer', data)
    })
    socket.on('webrtc_ice_candidate', (data) => {
      const room = `${socket.tenantId}:${socket.donorOrgId}`
      socket.to(room).emit('webrtc_ice_candidate', data)
    })

    socket.on('disconnect', () => {
      if (socket.userId) {
        onlineUsers.delete(socket.userId)
        if (socket.tenantId && socket.donorOrgId) {
          const room = `${socket.tenantId}:${socket.donorOrgId}`
          socket.to(room).emit('user_offline', { userId: socket.userId })
        }
      }
    })
  })

  return io
}

function getIO() { return io }
function getOnlineUsers() { return onlineUsers }

module.exports = { initSocketIO, getIO, getOnlineUsers }
