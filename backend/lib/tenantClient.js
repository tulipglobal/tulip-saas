const prisma = require('./client')

module.exports = function tenantClient(tenantId) {
  if (!tenantId) throw new Error('tenantId is required for tenantClient')

  return {
    project: {
      findMany:  (args = {}) => prisma.project.findMany({ ...args, where: { ...args.where, tenantId } }),
      findFirst: (args = {}) => prisma.project.findFirst({ ...args, where: { ...args.where, tenantId } }),
      create:    (args = {}) => prisma.project.create({ ...args, data: { ...args.data, tenantId } }),
      update:    (args = {}) => prisma.project.update(args),
      delete:    (args = {}) => prisma.project.delete(args),
      count:     (args = {}) => prisma.project.count({ ...args, where: { ...args.where, tenantId } }),
    },

    fundingSource: {
      findMany:  (args = {}) => prisma.fundingSource.findMany({ ...args, where: { ...args.where, tenantId } }),
      findFirst: (args = {}) => prisma.fundingSource.findFirst({ ...args, where: { ...args.where, tenantId } }),
      create:    (args = {}) => prisma.fundingSource.create({ ...args, data: { ...args.data, tenantId } }),
      update:    (args = {}) => prisma.fundingSource.update(args),
      delete:    (args = {}) => prisma.fundingSource.delete(args),
      count:     (args = {}) => prisma.fundingSource.count({ ...args, where: { ...args.where, tenantId } }),
    },

    expense: {
      findMany:  (args = {}) => prisma.expense.findMany({ ...args, where: { ...args.where, tenantId } }),
      findFirst: (args = {}) => prisma.expense.findFirst({ ...args, where: { ...args.where, tenantId } }),
      create:    (args = {}) => prisma.expense.create({ ...args, data: { ...args.data, tenantId } }),
      update:    (args = {}) => prisma.expense.update(args),
      delete:    (args = {}) => prisma.expense.delete(args),
      count:     (args = {}) => prisma.expense.count({ ...args, where: { ...args.where, tenantId } }),
    },

    document: {
      findMany:  (args = {}) => prisma.document.findMany({ ...args, where: { ...args.where, tenantId } }),
      findFirst: (args = {}) => prisma.document.findFirst({ ...args, where: { ...args.where, tenantId } }),
      create:    (args = {}) => prisma.document.create({ ...args, data: { ...args.data, tenantId } }),
      delete:    (args = {}) => prisma.document.delete(args),
      count:     (args = {}) => prisma.document.count({ ...args, where: { ...args.where, tenantId } }),
    },

    auditLog: {
      findMany:  (args = {}) => prisma.auditLog.findMany({ ...args, where: { ...args.where, tenantId } }),
      findFirst: (args = {}) => prisma.auditLog.findFirst({ ...args, where: { ...args.where, tenantId } }),
      create:    (args = {}) => prisma.auditLog.create({ ...args, data: { ...args.data, tenantId } }),
      count:     (args = {}) => prisma.auditLog.count({ ...args, where: { ...args.where, tenantId } }),
    },

    user: {
      findMany:  (args = {}) => prisma.user.findMany({ ...args, where: { ...args.where, tenantId } }),
      findFirst: (args = {}) => prisma.user.findFirst({ ...args, where: { ...args.where, tenantId } }),
      count:     (args = {}) => prisma.user.count({ ...args, where: { ...args.where, tenantId } }),
    },

    role: {
      findMany:  (args = {}) => prisma.role.findMany({ ...args, where: { ...args.where, tenantId } }),
      findFirst: (args = {}) => prisma.role.findFirst({ ...args, where: { ...args.where, tenantId } }),
      create:    (args = {}) => prisma.role.create({ ...args, data: { ...args.data, tenantId } }),
      delete:    (args = {}) => prisma.role.delete(args),
    },
  }
}
