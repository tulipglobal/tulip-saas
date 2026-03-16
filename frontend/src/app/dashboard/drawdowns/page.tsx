'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { apiGet, apiPost } from '@/lib/api'

/* ── types ── */
interface Drawdown {
  id: string
  investmentId: string
  projectName: string
  donorOrgName: string
  amount: number
  currency: string
  purpose: string
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'DISBURSED'
  requestedAt: string
  approvedAt: string | null
  reason: string | null
}

interface InvestmentOption {
  id: string
  projectName: string
  currency: string
  remaining: number
}

/* ── pills ── */
function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    REQUESTED: 'bg-amber-100 text-amber-700 border-amber-300',
    APPROVED: 'bg-green-100 text-green-700 border-green-300',
    REJECTED: 'bg-red-100 text-red-700 border-red-300',
    DISBURSED: 'bg-blue-100 text-blue-700 border-blue-300',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${map[status] ?? map.REQUESTED}`}>
      {status}
    </span>
  )
}

type TabKey = 'ALL' | 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'DISBURSED'

/* ── main page ── */
export default function DrawdownsPage() {
  const t = useTranslations('drawdowns')
  const [drawdowns, setDrawdowns] = useState<Drawdown[]>([])
  const [investmentOptions, setInvestmentOptions] = useState<InvestmentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('ALL')

  /* request drawdown modal */
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [reqInvestmentId, setReqInvestmentId] = useState('')
  const [reqAmount, setReqAmount] = useState('')
  const [reqPurpose, setReqPurpose] = useState('')
  const [reqSubmitting, setReqSubmitting] = useState(false)

  /* utilisation modal */
  const [utilDrawdown, setUtilDrawdown] = useState<Drawdown | null>(null)
  const [utilAmount, setUtilAmount] = useState('')
  const [utilNote, setUtilNote] = useState('')
  const [utilSubmitting, setUtilSubmitting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const res = await apiGet('/api/ngo/investments')
      if (res.ok) {
        const data = await res.json()
        const investments = data.investments ?? []

        /* flatten all drawdowns with parent info */
        const allDrawdowns: Drawdown[] = []
        const options: InvestmentOption[] = []

        for (const inv of investments) {
          options.push({
            id: inv.id,
            projectName: inv.projectName,
            currency: inv.currency,
            remaining: inv.totalFacility - inv.drawnDown,
          })
          for (const dd of inv.drawdowns ?? []) {
            allDrawdowns.push({
              ...dd,
              investmentId: inv.id,
              projectName: inv.projectName,
              donorOrgName: inv.donorOrgName,
              currency: dd.currency ?? inv.currency,
            })
          }
        }

        /* sort newest first */
        allDrawdowns.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
        setDrawdowns(allDrawdowns)
        setInvestmentOptions(options)
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  /* submit drawdown request */
  async function submitRequest() {
    if (!reqInvestmentId || !reqAmount || !reqPurpose.trim()) return
    setReqSubmitting(true)
    const selected = investmentOptions.find(o => o.id === reqInvestmentId)
    try {
      const res = await apiPost(`/api/ngo/investments/${reqInvestmentId}/drawdowns`, {
        amount: parseFloat(reqAmount),
        currency: selected?.currency ?? 'USD',
        purpose: reqPurpose.trim(),
      })
      if (res.ok) {
        setShowRequestModal(false)
        setReqInvestmentId('')
        setReqAmount('')
        setReqPurpose('')
        loadData()
      }
    } catch {
      /* ignore */
    } finally {
      setReqSubmitting(false)
    }
  }

  /* submit utilisation */
  async function submitUtilisation() {
    if (!utilDrawdown || !utilAmount) return
    setUtilSubmitting(true)
    try {
      const res = await apiPost(`/api/ngo/drawdowns/${utilDrawdown.id}/utilisation`, {
        amountUtilised: parseFloat(utilAmount),
        note: utilNote.trim(),
      })
      if (res.ok) {
        setUtilDrawdown(null)
        setUtilAmount('')
        setUtilNote('')
        loadData()
      }
    } catch {
      /* ignore */
    } finally {
      setUtilSubmitting(false)
    }
  }

  /* helpers */
  function fmtCurrency(amount: number, currency: string) {
    return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  function fmtDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const filtered = tab === 'ALL' ? drawdowns : drawdowns.filter(d => d.status === tab)

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'ALL', label: t('all') },
    { key: 'REQUESTED', label: t('requested') },
    { key: 'APPROVED', label: t('approved') },
    { key: 'REJECTED', label: t('rejected') },
    { key: 'DISBURSED', label: t('disbursed') },
  ]

  const selectedInvestment = investmentOptions.find(o => o.id === reqInvestmentId)

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>
            {t('title')}
          </h1>
          <p className="text-[var(--tulip-forest)]/60 text-sm mt-1">
            {t('subtitle')}
          </p>
        </div>
        <button
          onClick={() => { setShowRequestModal(true); setReqInvestmentId(''); setReqAmount(''); setReqPurpose('') }}
          className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--tulip-cream)] bg-[var(--tulip-forest)] hover:bg-[var(--tulip-forest)]/90 transition-colors self-start"
        >
          {t('requestDrawdown')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-[var(--tulip-sage-dark)] p-1 w-fit" style={{ background: 'var(--tulip-sage)' }}>
        {tabs.map(tb => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === tb.key
                ? 'bg-[var(--tulip-forest)] text-[var(--tulip-cream)]'
                : 'text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] hover:bg-[#d5e5cc]'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[var(--tulip-sage-dark)] overflow-hidden" style={{ background: 'var(--tulip-sage)' }}>
        {/* Desktop header */}
        <div className="hidden lg:grid grid-cols-[1.2fr_1.2fr_1fr_1.5fr_90px_100px_100px_120px] gap-4 px-5 py-3 border-b border-[var(--tulip-sage-dark)] text-[10px] text-[var(--tulip-forest)]/40 uppercase tracking-wider font-medium">
          <span>{t('thProject')}</span>
          <span>{t('thInvestor')}</span>
          <span>{t('thAmount')}</span>
          <span>{t('thPurpose')}</span>
          <span>{t('thStatus')}</span>
          <span>{t('thRequested')}</span>
          <span>{t('thApproved')}</span>
          <span>{t('thAction')}</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-[var(--tulip-forest)]/40 text-sm">{t('loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-[var(--tulip-forest)]/40 text-sm">{t('noDrawdowns')}</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--tulip-sage-dark)]">
            {filtered.map(dd => (
              <div key={dd.id}>
                {/* Desktop row */}
                <div className="hidden lg:grid grid-cols-[1.2fr_1.2fr_1fr_1.5fr_90px_100px_100px_120px] gap-4 px-5 py-3 items-center">
                  <div className="text-sm text-[var(--tulip-forest)] font-medium truncate">{dd.projectName}</div>
                  <div className="text-sm text-[var(--tulip-forest)]/70 truncate">{dd.donorOrgName}</div>
                  <div className="text-sm font-medium text-[var(--tulip-forest)]">{fmtCurrency(dd.amount, dd.currency)}</div>
                  <div className="text-xs text-[var(--tulip-forest)]/60 truncate">{dd.purpose}</div>
                  <div><StatusPill status={dd.status} /></div>
                  <div className="text-xs text-[var(--tulip-forest)]/50">{fmtDate(dd.requestedAt)}</div>
                  <div className="text-xs text-[var(--tulip-forest)]/50">{fmtDate(dd.approvedAt)}</div>
                  <div>
                    {dd.status === 'REQUESTED' && (
                      <span className="text-xs text-[var(--tulip-forest)]/40">{t('awaitingApproval')}</span>
                    )}
                    {dd.status === 'APPROVED' && (
                      <button
                        onClick={() => { setUtilDrawdown(dd); setUtilAmount(''); setUtilNote('') }}
                        className="px-3 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200 transition-colors"
                      >
                        {t('recordUtilisation')}
                      </button>
                    )}
                    {dd.status === 'REJECTED' && (
                      <span className="text-xs text-red-600">{dd.reason || t('rejectedLabel')}</span>
                    )}
                    {dd.status === 'DISBURSED' && (
                      <span className="text-xs text-blue-600 underline underline-offset-2 cursor-pointer">{t('view')}</span>
                    )}
                  </div>
                </div>

                {/* Mobile card */}
                <div className="lg:hidden px-5 py-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--tulip-forest)]">{dd.projectName}</span>
                    <StatusPill status={dd.status} />
                  </div>
                  <div className="text-xs text-[var(--tulip-forest)]/60">{dd.donorOrgName}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[var(--tulip-forest)]">{fmtCurrency(dd.amount, dd.currency)}</span>
                    <span className="text-[10px] text-[var(--tulip-forest)]/40">{fmtDate(dd.requestedAt)}</span>
                  </div>
                  <p className="text-xs text-[var(--tulip-forest)]/50">{dd.purpose}</p>
                  <div>
                    {dd.status === 'REQUESTED' && (
                      <span className="text-xs text-[var(--tulip-forest)]/40">{t('awaitingApproval')}</span>
                    )}
                    {dd.status === 'APPROVED' && (
                      <button
                        onClick={() => { setUtilDrawdown(dd); setUtilAmount(''); setUtilNote('') }}
                        className="px-3 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200 transition-colors"
                      >
                        {t('recordUtilisation')}
                      </button>
                    )}
                    {dd.status === 'REJECTED' && (
                      <span className="text-xs text-red-600">{dd.reason || t('rejectedLabel')}</span>
                    )}
                    {dd.status === 'DISBURSED' && (
                      <span className="text-xs text-blue-600 underline underline-offset-2 cursor-pointer">{t('view')}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Request Drawdown Modal ── */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowRequestModal(false)}>
          <div
            className="w-full max-w-md rounded-xl border border-[var(--tulip-sage-dark)] p-6 space-y-4 shadow-xl"
            style={{ background: 'var(--tulip-cream)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>
              {t('requestModalTitle')}
            </h3>

            {/* Project / Investment select */}
            <div>
              <label className="block text-xs font-medium text-[var(--tulip-forest)]/70 mb-1">{t('project')}</label>
              {investmentOptions.length === 0 ? (
                <div className="rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] px-3 py-3 text-sm text-[var(--tulip-forest)]/60">
                  {t('noInvestments')}
                </div>
              ) : (
                <select
                  value={reqInvestmentId}
                  onChange={e => { setReqInvestmentId(e.target.value); setReqAmount('') }}
                  className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] px-3 py-2 text-sm text-[var(--tulip-forest)] outline-none focus:border-[var(--tulip-forest)]/40"
                >
                  <option value="">{t('selectProject')}</option>
                  {investmentOptions.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.projectName} ({t('remaining')}: {o.currency} {o.remaining.toLocaleString()})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-medium text-[var(--tulip-forest)]/70 mb-1">{t('amount')}</label>
              <input
                type="number"
                min={0}
                max={selectedInvestment?.remaining ?? undefined}
                value={reqAmount}
                onChange={e => setReqAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] px-3 py-2 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/30 outline-none focus:border-[var(--tulip-forest)]/40"
              />
            </div>

            {/* Currency */}
            <div>
              <label className="block text-xs font-medium text-[var(--tulip-forest)]/70 mb-1">{t('currency')}</label>
              <input
                type="text"
                value={selectedInvestment?.currency ?? ''}
                readOnly
                className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]/60 px-3 py-2 text-sm text-[var(--tulip-forest)]/60 outline-none cursor-not-allowed"
              />
            </div>

            {/* Purpose */}
            <div>
              <label className="block text-xs font-medium text-[var(--tulip-forest)]/70 mb-1">{t('purpose')} <span className="text-red-500">*</span></label>
              <textarea
                value={reqPurpose}
                onChange={e => setReqPurpose(e.target.value)}
                rows={3}
                placeholder={t('purposePlaceholder')}
                className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] px-3 py-2 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/30 outline-none focus:border-[var(--tulip-forest)]/40 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowRequestModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--tulip-forest)]/60 border border-[var(--tulip-sage-dark)] hover:bg-[var(--tulip-sage)] transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={submitRequest}
                disabled={reqSubmitting || !reqInvestmentId || !reqAmount || !reqPurpose.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--tulip-cream)] bg-[var(--tulip-forest)] hover:bg-[var(--tulip-forest)]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {reqSubmitting ? t('submitting') : t('submitRequest')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Record Utilisation Modal ── */}
      {utilDrawdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setUtilDrawdown(null)}>
          <div
            className="w-full max-w-md rounded-xl border border-[var(--tulip-sage-dark)] p-6 space-y-4 shadow-xl"
            style={{ background: 'var(--tulip-cream)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>
              {t('utilisationTitle')}
            </h3>

            {/* Drawdown details */}
            <div className="rounded-lg border border-[var(--tulip-sage-dark)] p-3 space-y-1" style={{ background: 'var(--tulip-sage)' }}>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--tulip-forest)]/50">{t('project')}</span>
                <span className="text-[var(--tulip-forest)] font-medium">{utilDrawdown.projectName}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--tulip-forest)]/50">{t('drawdownAmount')}</span>
                <span className="text-[var(--tulip-forest)] font-medium">{fmtCurrency(utilDrawdown.amount, utilDrawdown.currency)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--tulip-forest)]/50">{t('purpose')}</span>
                <span className="text-[var(--tulip-forest)]">{utilDrawdown.purpose}</span>
              </div>
            </div>

            {/* Amount utilised */}
            <div>
              <label className="block text-xs font-medium text-[var(--tulip-forest)]/70 mb-1">{t('amountUtilised')}</label>
              <input
                type="number"
                min={0}
                max={utilDrawdown.amount}
                value={utilAmount}
                onChange={e => setUtilAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] px-3 py-2 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/30 outline-none focus:border-[var(--tulip-forest)]/40"
              />
            </div>

            {/* Note */}
            <div>
              <label className="block text-xs font-medium text-[var(--tulip-forest)]/70 mb-1">{t('note')}</label>
              <textarea
                value={utilNote}
                onChange={e => setUtilNote(e.target.value)}
                rows={3}
                placeholder={t('notePlaceholder')}
                className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] px-3 py-2 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/30 outline-none focus:border-[var(--tulip-forest)]/40 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setUtilDrawdown(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--tulip-forest)]/60 border border-[var(--tulip-sage-dark)] hover:bg-[var(--tulip-sage)] transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={submitUtilisation}
                disabled={utilSubmitting || !utilAmount}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--tulip-cream)] bg-[var(--tulip-forest)] hover:bg-[var(--tulip-forest)]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {utilSubmitting ? t('recording') : t('recordUtilisationBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
