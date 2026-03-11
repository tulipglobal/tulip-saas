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
      aggregate: (args = {}) => prisma.expense.aggregate({ ...args, where: { ...args.where, tenantId } }),
    },

    document: {
      findMany:  (args = {}) => prisma.document.findMany({ ...args, where: { ...args.where, tenantId } }),
      findFirst: (args = {}) => prisma.document.findFirst({ ...args, where: { ...args.where, tenantId } }),
      create:    (args = {}) => prisma.document.create({ ...args, data: { ...args.data, tenantId } }),
      delete:    (args = {}) => prisma.document.delete(args),
      count:     (args = {}) => prisma.document.count({ ...args, where: { ...args.where, tenantId } }),
    },

    budget: {
      findMany:  (args = {}) => prisma.budget.findMany({ ...args, where: { ...args.where, tenantId } }),
      findFirst: (args = {}) => prisma.budget.findFirst({ ...args, where: { ...args.where, tenantId } }),
      findUnique:(args = {}) => prisma.budget.findUnique(args),
      create:    (args = {}) => prisma.budget.create({ ...args, data: { ...args.data, tenantId } }),
      update:    (args = {}) => prisma.budget.update(args),
      delete:    (args = {}) => prisma.budget.delete(args),
      count:     (args = {}) => prisma.budget.count({ ...args, where: { ...args.where, tenantId } }),
    },

    fundingAgreement: {
      findMany:  (args = {}) => prisma.fundingAgreement.findMany({ ...args, where: { ...args.where, tenantId } }),
      findFirst: (args = {}) => prisma.fundingAgreement.findFirst({ ...args, where: { ...args.where, tenantId } }),
      create:    (args = {}) => prisma.fundingAgreement.create({ ...args, data: { ...args.data, tenantId } }),
      update:    (args = {}) => prisma.fundingAgreement.update(args),
      delete:    (args = {}) => prisma.fundingAgreement.delete(args),
      count:     (args = {}) => prisma.fundingAgreement.count({ ...args, where: { ...args.where, tenantId } }),
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

    ocrJob: {
      findMany:  (args = {}) => prisma.ocrJob.findMany({ ...args, where: { ...args.where, tenantId } }),
      findFirst: (args = {}) => prisma.ocrJob.findFirst({ ...args, where: { ...args.where, tenantId } }),
      create:    (args = {}) => prisma.ocrJob.create({ ...args, data: { ...args.data, tenantId } }),
      update:    (args = {}) => prisma.ocrJob.update(args),
      count:     (args = {}) => prisma.ocrJob.count({ ...args, where: { ...args.where, tenantId } }),
    },

    verificationCase: {
      findMany:  (args = {}) => prisma.verificationCase.findMany({ ...args, where: { ...args.where, tenantId } }),
      findFirst: (args = {}) => prisma.verificationCase.findFirst({ ...args, where: { ...args.where, tenantId } }),
      create:    (args = {}) => prisma.verificationCase.create({ ...args, data: { ...args.data, tenantId } }),
      update:    (args = {}) => prisma.verificationCase.update(args),
      delete:    (args = {}) => prisma.verificationCase.delete(args),
      count:     (args = {}) => prisma.verificationCase.count({ ...args, where: { ...args.where, tenantId } }),
    },

    trustSeal: {
      findMany:  (args = {}) => prisma.trustSeal.findMany({ ...args, where: { ...args.where, tenantId } }),
      findFirst: (args = {}) => prisma.trustSeal.findFirst({ ...args, where: { ...args.where, tenantId } }),
      create:    (args = {}) => prisma.trustSeal.create({ ...args, data: { ...args.data, tenantId } }),
      update:    (args = {}) => prisma.trustSeal.update(args),
      count:     (args = {}) => prisma.trustSeal.count({ ...args, where: { ...args.where, tenantId } }),
    },

    bundleJob: {
      findMany:  (args = {}) => prisma.bundleJob.findMany({ ...args, where: { ...args.where, tenantId } }),
      findFirst: (args = {}) => prisma.bundleJob.findFirst({ ...args, where: { ...args.where, tenantId } }),
      create:    (args = {}) => prisma.bundleJob.create({ ...args, data: { ...args.data, tenantId } }),
      update:    (args = {}) => prisma.bundleJob.update(args),
      count:     (args = {}) => prisma.bundleJob.count({ ...args, where: { ...args.where, tenantId } }),
    },
  }
}
