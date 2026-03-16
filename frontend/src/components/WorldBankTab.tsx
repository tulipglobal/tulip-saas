'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
import { Plus, Edit2, Trash2, X, Globe, FileText } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

interface WBComponent {
  id: string
  name: string
  wbBudget: number
  govBudget: number
  actualThisPeriod: number
  cumulativeActual: number
  currency: string
  createdAt: string
}

interface WBContract {
  id: string
  description: string
  procurementMethod: string
  estimatedCost: number
  actualCost: number | null
  currency: string
  status: string
  contractDate: string | null
  completionDate: string | null
  notes: string | null
  createdAt: string
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY', 'XOF', 'KES', 'NGN', 'ZAR', 'BRL', 'INR']
const PROCUREMENT_METHODS = ['ICB', 'NCB', 'SHOPPING', 'DIRECT', 'CQS', 'QCBS']
const CONTRACT_STATUSES = ['PLANNED', 'ONGOING', 'COMPLETED', 'CANCELLED']

// ── Helpers ────────────────────────────────────────────────────────────────

function methodPill(method: string) {
  return (
    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--tulip-sage)] text-[var(--tulip-forest)]/70 border border-[var(--tulip-sage-dark)]">
      {method}
    </span>
  )
}

function contractStatusPill(status: string) {
  const map: Record<string, { color: string; bg: string }> = {
    PLANNED: { color: '#6b7280', bg: '#f3f4f6' },
    ONGOING: { color: '#92400E', bg: '#FFFBEB' },
    COMPLETED: { color: '#166534', bg: '#F0FDF4' },
    CANCELLED: { color: '#991B1B', bg: '#FEF2F2' },
  }
  const s = map[status] ?? map.PLANNED
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: s.color, backgroundColor: s.bg }}>
      {status}
    </span>
  )
}

// ── Component ──────────────────────────────────────────────────────────────

export default function WorldBankTab({ projectId }: { projectId: string }) {
  const [components, setComponents] = useState<WBComponent[]>([])
  const [contracts, setContracts] = useState<WBContract[]>([])
  const [loading, setLoading] = useState(true)

  // Component modals
  const [showAddComponent, setShowAddComponent] = useState(false)
  const [editingActuals, setEditingActuals] = useState<WBComponent | null>(null)

  // Contract modals
  const [showAddContract, setShowAddContract] = useState(false)
  const [editingContract, setEditingContract] = useState<WBContract | null>(null)

  const fetchData = useCallback(() => {
    Promise.all([
      apiGet(`/api/ngo/projects/${projectId}/wb-components`).then(r => r.ok ? r.json() : { data: [] }),
      apiGet(`/api/ngo/projects/${projectId}/wb-contracts`).then(r => r.ok ? r.json() : { data: [] }),
    ]).then(([comp, cont]) => {
      setComponents(comp.components ?? comp.data ?? [])
      setContracts(cont.contracts ?? cont.data ?? [])
    }).catch(() => {})
      .finally(() => setLoading(false))
  }, [projectId])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDeleteComponent = async (id: string) => {
    if (!confirm('Delete this component?')) return
    const res = await apiDelete(`/api/ngo/wb-components/${id}`)
    if (res.ok) fetchData()
  }

  const handleDeleteContract = async (id: string) => {
    if (!confirm('Delete this contract?')) return
    const res = await apiDelete(`/api/ngo/wb-contracts/${id}`)
    if (res.ok) fetchData()
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-[var(--tulip-gold)] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-8">
      {/* ── Project Components ────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-[var(--tulip-forest)]" />
              <h3 className="text-sm font-semibold text-[var(--tulip-forest)]">Project Components</h3>
            </div>
            <p className="text-xs text-[var(--tulip-forest)]/50 mt-0.5 ml-6">Budget breakdown by World Bank component</p>
          </div>
          <button onClick={() => setShowAddComponent(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-[var(--tulip-forest)] px-4 py-2 rounded-lg bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)] transition-all">
            <Plus size={14} /> Add Component
          </button>
        </div>

        <div className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl overflow-hidden">
          {components.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--tulip-forest)]/40 gap-2">
              <Globe size={32} className="text-[var(--tulip-forest)]/30" />
              <p className="text-sm">No World Bank components added yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--tulip-sage-dark)]">
                    <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">COMPONENT</th>
                    <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">WB BUDGET</th>
                    <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">GOV BUDGET</th>
                    <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">ACTUAL THIS PERIOD</th>
                    <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">CUMULATIVE</th>
                    <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">CURRENCY</th>
                    <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {components.map((comp, idx) => (
                    <tr key={comp.id} className={`border-b border-[var(--tulip-sage-dark)] hover:bg-[var(--tulip-sage)]/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-[var(--tulip-sage)]'}`}>
                      <td className="px-4 py-3 text-sm text-[var(--tulip-forest)]">{comp.name}</td>
                      <td className="px-4 py-3 text-sm text-[var(--tulip-forest)] font-medium">{comp.wbBudget.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-[var(--tulip-forest)]/60">{comp.govBudget.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-[var(--tulip-forest)]/60">{comp.actualThisPeriod.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-[var(--tulip-forest)]/60">{comp.cumulativeActual.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs text-[var(--tulip-forest)]/60">{comp.currency}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setEditingActuals(comp)} className="text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] transition-colors" title="Update Actuals">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDeleteComponent(comp.id)} className="text-[var(--tulip-forest)]/60 hover:text-red-600 transition-colors" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Procurement Contracts ─────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-[var(--tulip-forest)]" />
              <h3 className="text-sm font-semibold text-[var(--tulip-forest)]">Procurement Contracts</h3>
            </div>
            <p className="text-xs text-[var(--tulip-forest)]/50 mt-0.5 ml-6">Track contracts for World Bank reporting</p>
          </div>
          <button onClick={() => setShowAddContract(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-[var(--tulip-forest)] px-4 py-2 rounded-lg bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)] transition-all">
            <Plus size={14} /> Add Contract
          </button>
        </div>

        <div className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl overflow-hidden">
          {contracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--tulip-forest)]/40 gap-2">
              <FileText size={32} className="text-[var(--tulip-forest)]/30" />
              <p className="text-sm">No procurement contracts added yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--tulip-sage-dark)]">
                    <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">DESCRIPTION</th>
                    <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">METHOD</th>
                    <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">EST COST</th>
                    <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">ACTUAL</th>
                    <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">STATUS</th>
                    <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">CONTRACT DATE</th>
                    <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">COMPLETION</th>
                    <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((contract, idx) => (
                    <tr key={contract.id} className={`border-b border-[var(--tulip-sage-dark)] hover:bg-[var(--tulip-sage)]/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-[var(--tulip-sage)]'}`}>
                      <td className="px-4 py-3 text-sm text-[var(--tulip-forest)] max-w-[200px] truncate">{contract.description}</td>
                      <td className="px-4 py-3">{methodPill(contract.procurementMethod)}</td>
                      <td className="px-4 py-3 text-sm text-[var(--tulip-forest)] font-medium">{contract.currency} {contract.estimatedCost.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-[var(--tulip-forest)]/60">{contract.actualCost != null ? `${contract.currency} ${contract.actualCost.toLocaleString()}` : '-'}</td>
                      <td className="px-4 py-3">{contractStatusPill(contract.status)}</td>
                      <td className="px-4 py-3 text-xs text-[var(--tulip-forest)]/60">{contract.contractDate ? new Date(contract.contractDate).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-3 text-xs text-[var(--tulip-forest)]/60">{contract.completionDate ? new Date(contract.completionDate).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setEditingContract(contract)} className="text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] transition-colors" title="Edit">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDeleteContract(contract.id)} className="text-[var(--tulip-forest)]/60 hover:text-red-600 transition-colors" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────── */}

      {/* Add Component Modal */}
      {showAddComponent && (
        <Modal title="Add Component" onClose={() => setShowAddComponent(false)}>
          <ComponentForm onSave={async (data) => {
            const res = await apiPost(`/api/ngo/projects/${projectId}/wb-components`, data)
            if (res.ok) { fetchData(); setShowAddComponent(false) }
          }} onCancel={() => setShowAddComponent(false)} />
        </Modal>
      )}

      {/* Update Actuals Modal */}
      {editingActuals && (
        <Modal title={`Update Actuals — ${editingActuals.name}`} onClose={() => setEditingActuals(null)}>
          <ActualsForm initial={editingActuals} onSave={async (data) => {
            const res = await apiPut(`/api/ngo/wb-components/${editingActuals.id}`, data)
            if (res.ok) { fetchData(); setEditingActuals(null) }
          }} onCancel={() => setEditingActuals(null)} />
        </Modal>
      )}

      {/* Add Contract Modal */}
      {showAddContract && (
        <Modal title="Add Contract" onClose={() => setShowAddContract(false)}>
          <ContractForm onSave={async (data) => {
            const res = await apiPost(`/api/ngo/projects/${projectId}/wb-contracts`, data)
            if (res.ok) { fetchData(); setShowAddContract(false) }
          }} onCancel={() => setShowAddContract(false)} />
        </Modal>
      )}

      {/* Update Contract Modal */}
      {editingContract && (
        <Modal title="Update Contract" onClose={() => setEditingContract(null)}>
          <ContractUpdateForm initial={editingContract} onSave={async (data) => {
            const res = await apiPut(`/api/ngo/wb-contracts/${editingContract.id}`, data)
            if (res.ok) { fetchData(); setEditingContract(null) }
          }} onCancel={() => setEditingContract(null)} />
        </Modal>
      )}
    </div>
  )
}

// ── Shared Modal Wrapper ───────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-[var(--tulip-cream)] rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-[var(--tulip-forest)]">{title}</h2>
          <button onClick={onClose} className="text-[var(--tulip-forest)]/40 hover:text-[var(--tulip-forest)]"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Component Form (Add) ───────────────────────────────────────────────────

function ComponentForm({ onSave, onCancel }: { onSave: (data: any) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [wbBudget, setWbBudget] = useState('')
  const [govBudget, setGovBudget] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await onSave({ name, wbBudget: +wbBudget || 0, govBudget: +govBudget || 0, currency })
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-medium text-[var(--tulip-forest)]/70 block mb-1">Component Name *</label>
        <input required type="text" value={name} onChange={e => setName(e.target.value)}
          className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-sm text-[var(--tulip-forest)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/50" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-[var(--tulip-forest)]/70 block mb-1">WB Budget</label>
          <input type="number" step="0.01" value={wbBudget} onChange={e => setWbBudget(e.target.value)}
            className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-sm text-[var(--tulip-forest)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/50" />
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--tulip-forest)]/70 block mb-1">Gov Budget</label>
          <input type="number" step="0.01" value={govBudget} onChange={e => setGovBudget(e.target.value)}
            className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-sm text-[var(--tulip-forest)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/50" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-[var(--tulip-forest)]/70 block mb-1">Currency</label>
        <select value={currency} onChange={e => setCurrency(e.target.value)}
          className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-sm text-[var(--tulip-forest)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/50">
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-[var(--tulip-sage-dark)] text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] transition-all">Cancel</button>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)] text-[var(--tulip-forest)] font-medium transition-all disabled:opacity-50">
          {saving ? 'Saving...' : 'Add Component'}
        </button>
      </div>
    </form>
  )
}

// ── Actuals Form (Update) ──────────────────────────────────────────────────

function ActualsForm({ initial, onSave, onCancel }: { initial: WBComponent; onSave: (data: any) => Promise<void>; onCancel: () => void }) {
  const [actualThisPeriod, setActualThisPeriod] = useState(String(initial.actualThisPeriod || ''))
  const [cumulativeActual, setCumulativeActual] = useState(String(initial.cumulativeActual || ''))
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await onSave({ actualThisPeriod: +actualThisPeriod || 0, cumulativeActual: +cumulativeActual || 0 })
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-medium text-[var(--tulip-forest)]/70 block mb-1">Actual This Period</label>
        <input type="number" step="0.01" value={actualThisPeriod} onChange={e => setActualThisPeriod(e.target.value)}
          className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-sm text-[var(--tulip-forest)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/50" />
      </div>
      <div>
        <label className="text-xs font-medium text-[var(--tulip-forest)]/70 block mb-1">Cumulative Actual</label>
        <input type="number" step="0.01" value={cumulativeActual} onChange={e => setCumulativeActual(e.target.value)}
          className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-sm text-[var(--tulip-forest)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/50" />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-[var(--tulip-sage-dark)] text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] transition-all">Cancel</button>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)] text-[var(--tulip-forest)] font-medium transition-all disabled:opacity-50">
          {saving ? 'Saving...' : 'Update Actuals'}
        </button>
      </div>
    </form>
  )
}

// ── Contract Form (Add) ────────────────────────────────────────────────────

function ContractForm({ onSave, onCancel }: { onSave: (data: any) => Promise<void>; onCancel: () => void }) {
  const [description, setDescription] = useState('')
  const [procurementMethod, setProcurementMethod] = useState('ICB')
  const [estimatedCost, setEstimatedCost] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [contractDate, setContractDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await onSave({
      description, procurementMethod, estimatedCost: +estimatedCost || 0, currency,
      contractDate: contractDate || null, notes: notes || null,
    })
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-medium text-[var(--tulip-forest)]/70 block mb-1">Description *</label>
        <input required type="text" value={description} onChange={e => setDescription(e.target.value)}
          className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-sm text-[var(--tulip-forest)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/50" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-[var(--tulip-forest)]/70 block mb-1">Procurement Method *</label>
          <select required value={procurementMethod} onChange={e => setProcurementMethod(e.target.value)}
            className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-sm text-[var(--tulip-forest)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/50">
            {PROCUREMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--tulip-forest)]/70 block mb-1">Estimated Cost *</label>
          <input required type="number" step="0.01" value={estimatedCost} onChange={e => setEstimatedCost(e.target.value)}
            className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-sm text-[var(--tulip-forest)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/50" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-[var(--tulip-forest)]/70 block mb-1">Currency</label>
          <select value={currency} onChange={e => setCurrency(e.target.value)}
            className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-sm text-[var(--tulip-forest)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/50">
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--tulip-forest)]/70 block mb-1">Contract Date</label>
          <input type="date" value={contractDate} onChange={e => setContractDate(e.target.value)}
            className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-sm text-[var(--tulip-forest)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/50" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-[var(--tulip-forest)]/70 block mb-1">Notes</label>
        <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
          className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-sm text-[var(--tulip-forest)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/50" />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-[var(--tulip-sage-dark)] text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] transition-all">Cancel</button>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)] text-[var(--tulip-forest)] font-medium transition-all disabled:opacity-50">
          {saving ? 'Saving...' : 'Add Contract'}
        </button>
      </div>
    </form>
  )
}

// ── Contract Update Form ───────────────────────────────────────────────────

function ContractUpdateForm({ initial, onSave, onCancel }: { initial: WBContract; onSave: (data: any) => Promise<void>; onCancel: () => void }) {
  const [actualCost, setActualCost] = useState(String(initial.actualCost ?? ''))
  const [status, setStatus] = useState(initial.status || 'PLANNED')
  const [completionDate, setCompletionDate] = useState(initial.completionDate ? initial.completionDate.slice(0, 10) : '')
  const [notes, setNotes] = useState(initial.notes ?? '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await onSave({
      actualCost: actualCost ? +actualCost : null, status,
      completionDate: completionDate || null, notes: notes || null,
    })
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-medium text-[var(--tulip-forest)]/70 block mb-1">Actual Cost</label>
        <input type="number" step="0.01" value={actualCost} onChange={e => setActualCost(e.target.value)}
          className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-sm text-[var(--tulip-forest)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/50" />
      </div>
      <div>
        <label className="text-xs font-medium text-[var(--tulip-forest)]/70 block mb-1">Status</label>
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-sm text-[var(--tulip-forest)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/50">
          {CONTRACT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-[var(--tulip-forest)]/70 block mb-1">Completion Date</label>
        <input type="date" value={completionDate} onChange={e => setCompletionDate(e.target.value)}
          className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-sm text-[var(--tulip-forest)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/50" />
      </div>
      <div>
        <label className="text-xs font-medium text-[var(--tulip-forest)]/70 block mb-1">Notes</label>
        <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
          className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-sm text-[var(--tulip-forest)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/50" />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-[var(--tulip-sage-dark)] text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] transition-all">Cancel</button>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)] text-[var(--tulip-forest)] font-medium transition-all disabled:opacity-50">
          {saving ? 'Saving...' : 'Update Contract'}
        </button>
      </div>
    </form>
  )
}
