'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Save, UserPlus, Building2, Globe, Mail } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import { FUNDING_SOURCE_TYPES, FUNDING_SOURCE_TYPE_KEYS } from '@/lib/ngo-categories'
import CurrencySelect from '@/components/CurrencySelect'

interface Donor { id: string; name: string; type: string }
interface DonorOrg { id: string; name: string; type: string; country: string | null; website: string | null }
interface BudgetOption { id: string; name: string; status: string; totalApproved: number }

export default function NewFundingPage() {
  const t = useTranslations()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [donors, setDonors] = useState<Donor[]>([])
  const [donorOrgs, setDonorOrgs] = useState<DonorOrg[]>([])
  const [budgets, setBudgets] = useState<BudgetOption[]>([])
  const [funderOption, setFunderOption] = useState<'portal' | 'invite' | 'external'>('external')
  const [inviteForm, setInviteForm] = useState({ orgName: '', email: '' })
  const [form, setForm] = useState({
    title: '', type: 'GRANT', totalAmount: '', currency: 'USD',
    donorId: '', donorOrgId: '', budgetId: '', startDate: '', endDate: '', repayable: false,
    interestRate: '', notes: '', funderName: '',
    sourceType: '', sourceSubType: '',
    grantorName: '', grantRef: '', grantFrom: '', grantTo: '',
    restricted: false, capexBudget: '', opexBudget: '',
  })

  useEffect(() => {
    apiGet('/api/donors')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => setDonors(d.data ?? []))
      .catch(() => {})
    apiGet('/api/donor/organisations')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => setDonorOrgs(d.data ?? []))
      .catch(() => {})
    apiGet('/api/budgets?limit=100')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => setBudgets((d.data ?? []).filter((b: BudgetOption) => b.status !== 'CLOSED')))
      .catch(() => {})
  }, [])

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  const subTypes = useMemo(() => {
    if (!form.sourceType) return []
    return FUNDING_SOURCE_TYPES[form.sourceType] ?? []
  }, [form.sourceType])

  const totalBudget = useMemo(() => {
    const capex = parseFloat(form.capexBudget) || 0
    const opex = parseFloat(form.opexBudget) || 0
    return capex + opex
  }, [form.capexBudget, form.opexBudget])

  const submit = async () => {
    if (!form.title.trim()) { setError(t('fundingNew.titleRequired')); return }
    const total = parseFloat(form.totalAmount) || totalBudget
    if (!total) { setError(t('fundingNew.validAmountRequired')); return }

    // Validate funder selection
    if (funderOption === 'portal' && !form.donorOrgId) { setError(t('fundingNew.selectDonorOrgError')); return }
    if (funderOption === 'invite' && (!inviteForm.orgName.trim() || !inviteForm.email.trim())) { setError(t('fundingNew.orgEmailRequired')); return }
    if (funderOption === 'external' && !form.funderName.trim()) { setError(t('fundingNew.funderNameRequired')); return }

    setSaving(true); setError('')
    try {
      // For invite option, send the invite first
      let linkedDonorOrgId: string | null = null
      if (funderOption === 'invite') {
        const inviteRes = await apiPost('/api/donor-invite', {
          email: inviteForm.email.trim(),
          donorName: inviteForm.orgName.trim(),
          inviteType: 'NGO_INVITES_DONOR',
        })
        if (!inviteRes.ok) {
          const d = await inviteRes.json()
          setError(d.error ?? t('fundingNew.failedToInvite'))
          setSaving(false)
          return
        }
      }

      const funderType = funderOption === 'external' ? 'EXTERNAL' : 'PORTAL'
      const funderName = funderOption === 'external'
        ? form.funderName.trim()
        : funderOption === 'portal'
          ? donorOrgs.find(o => o.id === form.donorOrgId)?.name || ''
          : inviteForm.orgName.trim()

      const res = await apiPost('/api/funding-agreements', {
        title: form.title.trim(),
        type: form.type,
        totalAmount: total,
        currency: form.currency,
        donorId: form.donorId || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        repayable: form.repayable,
        interestRate: form.interestRate ? parseFloat(form.interestRate) : null,
        notes: form.notes || null,
        budgetId: form.budgetId || null,
        sourceType: form.sourceType || null,
        sourceSubType: form.sourceSubType || null,
        grantorName: form.grantorName || null,
        grantRef: form.grantRef || null,
        grantFrom: form.grantFrom || null,
        grantTo: form.grantTo || null,
        restricted: form.restricted,
        capexBudget: parseFloat(form.capexBudget) || 0,
        opexBudget: parseFloat(form.opexBudget) || 0,
        funderType,
        funderName,
        donorOrgId: funderOption === 'portal' ? form.donorOrgId : (linkedDonorOrgId || null),
      })
      if (res.ok) { router.push('/dashboard/funding') }
      else { const d = await res.json(); setError(d.error ?? t('fundingNew.failedToCreate')) }
    } catch { setError(t('fundingNew.networkError')) }
    setSaving(false)
  }

  const inputCls = "w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)] transition-all"
  const labelCls = "block text-xs font-medium text-[var(--tulip-forest)]/60 mb-1.5 uppercase tracking-wide"
  const optionBtnCls = (active: boolean) =>
    `flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all border ${
      active
        ? 'bg-[var(--tulip-gold)] border-[#f0a04b] text-[var(--tulip-forest)]'
        : 'bg-[var(--tulip-sage)] border-[var(--tulip-sage-dark)] text-[var(--tulip-forest)]/50 hover:border-[var(--tulip-gold)]/50'
    }`

  return (
    <div className="p-6 max-w-2xl animate-fade-up">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/funding" className="text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>{t('fundingNew.title')}</h1>
          <p className="text-[var(--tulip-forest)]/60 text-sm">{t('fundingNew.subtitle')}</p>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--tulip-sage-dark)] p-6 space-y-5"
        style={{ background: 'var(--tulip-sage)' }}>

        <div>
          <label className={labelCls}>{t('fundingNew.titleLabel')} *</label>
          <input value={form.title} onChange={e => set('title', e.target.value)}
            placeholder={t('fundingNew.titlePlaceholder')} className={inputCls} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{t('fundingNew.type')}</label>
            <select value={form.type} onChange={e => set('type', e.target.value)} className={inputCls}>
              <option value="GRANT">{t('fundingNew.grant')}</option>
              <option value="LOAN">{t('fundingNew.loan')}</option>
              <option value="DONATION">{t('fundingNew.donation')}</option>
              <option value="EQUITY">{t('fundingNew.equity')}</option>
              <option value="IN_KIND">{t('fundingNew.inKind')}</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>{t('fundingNew.currency')}</label>
            <CurrencySelect value={form.currency} onChange={v => set('currency', v)} />
          </div>
        </div>

        {/* Funding Source Type */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{t('fundingNew.sourceType')}</label>
            <select value={form.sourceType}
              onChange={e => { set('sourceType', e.target.value); set('sourceSubType', '') }}
              className={inputCls}>
              <option value="">{t('fundingNew.selectSourceType')}</option>
              {FUNDING_SOURCE_TYPE_KEYS.map(t2 => <option key={t2} value={t2}>{t2}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t('fundingNew.sourceSubType')}</label>
            <select value={form.sourceSubType} onChange={e => set('sourceSubType', e.target.value)}
              className={inputCls} disabled={!form.sourceType}>
              <option value="">{t('fundingNew.selectSubType')}</option>
              {subTypes.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>
        </div>

        {/* Link to Budget */}
        <div>
          <label className={labelCls}>{t('fundingNew.linkToBudget')}</label>
          <select value={form.budgetId} onChange={e => set('budgetId', e.target.value)} className={inputCls}>
            <option value="">{t('fundingNew.noBudgetLinked')}</option>
            {budgets.map(b => <option key={b.id} value={b.id}>{b.name} ({b.status}) — ${b.totalApproved?.toLocaleString()}</option>)}
          </select>
        </div>

        {/* Budget: CapEx / OpEx Split */}
        <div className="rounded-lg border border-[var(--tulip-sage-dark)] p-4 space-y-3 bg-[var(--tulip-sage)]">
          <label className={labelCls + ' mb-0'}>{t('fundingNew.budgetSplit')}</label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-[var(--tulip-forest)]/40 mb-1 block">{t('fundingNew.capexBudget')}</label>
              <input type="number" step="0.01" value={form.capexBudget}
                onChange={e => set('capexBudget', e.target.value)}
                placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] text-[var(--tulip-forest)]/40 mb-1 block">{t('fundingNew.opexBudget')}</label>
              <input type="number" step="0.01" value={form.opexBudget}
                onChange={e => set('opexBudget', e.target.value)}
                placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] text-[var(--tulip-forest)]/40 mb-1 block">{t('fundingNew.totalBudget')}</label>
              <div className={inputCls + ' bg-[var(--tulip-sage)] cursor-default'}>
                {form.currency} {totalBudget.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className={labelCls}>{t('fundingNew.totalAmount')} * {totalBudget > 0 && <span className="text-[var(--tulip-forest)]/30 normal-case">({t('fundingNew.autoFilledFromBudget')})</span>}</label>
          <input type="number" step="0.01"
            value={form.totalAmount || (totalBudget > 0 ? totalBudget.toString() : '')}
            onChange={e => set('totalAmount', e.target.value)}
            placeholder="0.00" className={inputCls} />
        </div>

        {/* Funder Selection — 3-option selector */}
        <div>
          <label className={labelCls}>{t('fundingNew.funder')} *</label>
          <div className="flex gap-2 mb-3">
            <button onClick={() => setFunderOption('portal')} className={optionBtnCls(funderOption === 'portal')}>
              <Building2 size={13} className="inline mr-1.5 -mt-0.5" />{t('fundingNew.existingDonor')}
            </button>
            <button onClick={() => setFunderOption('invite')} className={optionBtnCls(funderOption === 'invite')}>
              <Mail size={13} className="inline mr-1.5 -mt-0.5" />{t('fundingNew.inviteNew')}
            </button>
            <button onClick={() => setFunderOption('external')} className={optionBtnCls(funderOption === 'external')}>
              <Globe size={13} className="inline mr-1.5 -mt-0.5" />{t('fundingNew.external')}
            </button>
          </div>

          {funderOption === 'portal' && (
            <select value={form.donorOrgId} onChange={e => set('donorOrgId', e.target.value)} className={inputCls}>
              <option value="">{t('fundingNew.selectDonorOrg')}</option>
              {donorOrgs.map(o => <option key={o.id} value={o.id}>{o.name}{o.type ? ` (${o.type})` : ''}</option>)}
            </select>
          )}

          {funderOption === 'invite' && (
            <div className="space-y-3 border border-[var(--tulip-sage-dark)] rounded-lg p-4 bg-[var(--tulip-sage)]">
              <p className="text-xs text-[var(--tulip-forest)]/50">{t('fundingNew.inviteHint')}</p>
              <input value={inviteForm.orgName} onChange={e => setInviteForm(f => ({ ...f, orgName: e.target.value }))}
                placeholder={t('fundingNew.orgNamePlaceholder')} className={inputCls} />
              <input value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                placeholder={t('fundingNew.emailPlaceholder')} type="email" className={inputCls} />
            </div>
          )}

          {funderOption === 'external' && (
            <input value={form.funderName} onChange={e => set('funderName', e.target.value)}
              placeholder={t('fundingNew.externalPlaceholder')} className={inputCls} />
          )}
        </div>

        {/* Grant details */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{t('fundingNew.grantorName')}</label>
            <input value={form.grantorName} onChange={e => set('grantorName', e.target.value)}
              placeholder={t('fundingNew.grantorPlaceholder')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t('fundingNew.grantReference')}</label>
            <input value={form.grantRef} onChange={e => set('grantRef', e.target.value)}
              placeholder={t('fundingNew.grantRefPlaceholder')} className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{t('fundingNew.grantPeriodFrom')}</label>
            <input type="date" value={form.grantFrom} onChange={e => set('grantFrom', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t('fundingNew.grantPeriodTo')}</label>
            <input type="date" value={form.grantTo} onChange={e => set('grantTo', e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{t('fundingNew.startDate')}</label>
            <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t('fundingNew.endDate')}</label>
            <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <button onClick={() => set('restricted', !form.restricted)}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.restricted ? 'bg-[var(--tulip-gold)]' : 'bg-gray-500'}`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.restricted ? 'left-5' : 'left-0.5'}`} />
            </button>
            <span className="text-sm text-[var(--tulip-forest)]/70">{t('fundingNew.restricted')}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => set('repayable', !form.repayable)}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.repayable ? 'bg-[var(--tulip-gold)]' : 'bg-gray-500'}`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.repayable ? 'left-5' : 'left-0.5'}`} />
            </button>
            <span className="text-sm text-[var(--tulip-forest)]/70">{t('fundingNew.repayable')}</span>
          </div>
        </div>

        {form.repayable && (
          <div>
            <label className={labelCls}>{t('fundingNew.interestRate')}</label>
            <input type="number" step="0.01" value={form.interestRate} onChange={e => set('interestRate', e.target.value)}
              placeholder={t('fundingNew.interestPlaceholder')} className={inputCls} />
          </div>
        )}

        <div>
          <label className={labelCls}>{t('fundingNew.notes')}</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder={t('fundingNew.notesPlaceholder')} rows={2} className={inputCls + ' resize-none'} />
        </div>

        {error && (
          <div className="rounded-lg bg-red-400/10 border border-red-400/20 px-4 py-3 text-sm text-red-400">{error}</div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button onClick={submit} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-[var(--tulip-forest)] disabled:opacity-50 bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)] transition-all">
            <Save size={15} /> {saving ? t('fundingNew.creating') : t('fundingNew.createAgreement')}
          </button>
          <Link href="/dashboard/funding" className="px-5 py-2.5 rounded-lg text-sm text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] transition-colors">
            {t('fundingNew.cancel')}
          </Link>
        </div>
      </div>
    </div>
  )
}
