'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import {
  CreditCard, Users, FileCheck, Sparkles, ExternalLink,
  Check, Crown, Zap, ArrowUpRight, Loader2, AlertTriangle,
  Receipt
} from 'lucide-react'

interface SubscriptionData {
  plan: string
  planStatus: string
  trialEndsAt: string | null
  trialActive: boolean
  trialDaysLeft: number
  usage: { users: number; documents: number }
  limits: { maxUsers: number; maxDocuments: number }
  subscription: {
    id: string
    status: string
    currentPeriodEnd: number
    cancelAtPeriodEnd: boolean
  } | null
  invoices: {
    id: string
    number: string
    status: string
    amount: number
    currency: string
    created: number
    invoiceUrl: string | null
    pdfUrl: string | null
  }[]
}

const PLANS = [
  {
    id: 'FREE',
    name: 'Free Trial',
    price: null,
    priceLabel: 'Free',
    subLabel: '14-day trial',
    icon: Sparkles,
    color: '#64748b',
    colorDim: 'rgba(100,116,139,0.12)',
    colorBorder: 'rgba(100,116,139,0.25)',
    features: ['Up to 3 users', '5 documents/month', 'Basic audit trail', 'Public verification'],
  },
  {
    id: 'STARTER',
    name: 'Starter',
    price: 299,
    priceLabel: 'AED 299',
    subLabel: '/month',
    icon: Zap,
    color: '#f6c453',
    colorDim: 'rgba(246,196,83,0.12)',
    colorBorder: 'rgba(246,196,83,0.25)',
    features: ['Up to 3 users', '100 documents/month', 'Blockchain anchoring', 'RFC 3161 timestamps', 'Email support'],
  },
  {
    id: 'PRO',
    name: 'Professional',
    price: 899,
    priceLabel: 'AED 899',
    subLabel: '/month',
    icon: Crown,
    color: '#a855f7',
    colorDim: 'rgba(168,85,247,0.12)',
    colorBorder: 'rgba(168,85,247,0.25)',
    popular: true,
    features: ['Up to 10 users', '500 documents/month', 'Blockchain anchoring', 'RFC 3161 timestamps', 'Priority support', 'API access', 'Custom webhooks'],
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: null,
    priceLabel: 'Custom',
    subLabel: 'contact us',
    icon: Crown,
    color: '#f59e0b',
    colorDim: 'rgba(245,158,11,0.12)',
    colorBorder: 'rgba(245,158,11,0.25)',
    features: ['Unlimited users', 'Unlimited documents', 'Dedicated account manager', 'SSO / SAML', 'Custom SLA', 'On-premise option'],
  },
]

function UsageBar({ used, max, label }: { used: number; max: number; label: string }) {
  const pct = max === -1 ? 0 : max > 0 ? Math.min((used / max) * 100, 100) : 0
  const isUnlimited = max === -1
  const isNear = pct >= 80
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-[#183a1d]/70">{label}</span>
        <span className="text-sm font-medium text-[#183a1d]">
          {used}{isUnlimited ? '' : ` / ${max}`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/8 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: isUnlimited ? '5%' : `${Math.max(pct, 2)}%`,
            background: isNear ? '#ef4444' : '#f6c453',
          }}
        />
      </div>
    </div>
  )
}

export default function BillingPage() {
  const [data, setData] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    apiGet('/api/billing/subscription')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleCheckout = async (plan: string) => {
    setCheckoutLoading(plan)
    try {
      const res = await apiPost('/api/billing/create-checkout', { plan })
      const body = await res.json()
      if (body.url) {
        window.location.href = body.url
      }
    } catch {
      // silent
    } finally {
      setCheckoutLoading(null)
    }
  }

  const handlePortal = async () => {
    setPortalLoading(true)
    try {
      const res = await apiPost('/api/billing/portal', {})
      const body = await res.json()
      if (body.url) {
        window.location.href = body.url
      }
    } catch {
      // silent
    } finally {
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-[#183a1d]/40 animate-spin" />
      </div>
    )
  }

  const currentPlan = data?.plan || 'FREE'

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-up">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>
          Billing
        </h1>
        <p className="text-[#183a1d]/60 text-sm mt-1">Manage your subscription, usage, and payment history</p>
      </div>

      {/* Trial banner */}
      {data?.trialActive && currentPlan === 'FREE' && (
        <div className="rounded-xl border p-4 flex items-center gap-4"
          style={{ background: 'rgba(246,196,83,0.06)', borderColor: 'rgba(246,196,83,0.2)' }}>
          <Sparkles size={20} className="text-[#f6c453] shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-[#183a1d]">
              {data.trialDaysLeft} day{data.trialDaysLeft !== 1 ? 's' : ''} left in your free trial
            </div>
            <div className="text-xs text-[#183a1d]/60 mt-0.5">
              Choose a plan below to continue using Tulip DS after your trial ends
            </div>
          </div>
        </div>
      )}

      {/* Trial expired */}
      {data && !data.trialActive && currentPlan === 'FREE' && (
        <div className="rounded-xl border p-4 flex items-center gap-4"
          style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)' }}>
          <AlertTriangle size={20} className="text-red-400 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-[#183a1d]">Your free trial has expired</div>
            <div className="text-xs text-[#183a1d]/60 mt-0.5">
              You are limited to 5 documents. Upgrade below to unlock full access.
            </div>
          </div>
        </div>
      )}

      {/* Current plan + Usage */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Current plan card */}
        <div className="rounded-xl border border-[#c8d6c0] p-5" style={{ background: '#e1eedd' }}>
          <div className="text-xs text-[#183a1d]/60 uppercase tracking-wider font-medium mb-3">Current Plan</div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: PLANS.find(p => p.id === currentPlan)?.colorDim || 'rgba(100,116,139,0.12)' }}>
              <CreditCard size={18} style={{ color: PLANS.find(p => p.id === currentPlan)?.color || '#64748b' }} />
            </div>
            <div>
              <div className="text-lg font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>
                {PLANS.find(p => p.id === currentPlan)?.name || 'Free'}
              </div>
              <div className="text-xs text-[#183a1d]/60">
                {data?.planStatus === 'cancelling' ? 'Cancels at period end' :
                 data?.planStatus === 'past_due' ? 'Payment overdue' :
                 data?.subscription ? `Renews ${new Date(data.subscription.currentPeriodEnd * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` :
                 data?.trialActive ? `Trial ends ${new Date(data.trialEndsAt!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` :
                 currentPlan !== 'FREE' && data?.planStatus === 'active' ? 'Active' :
                 'No active subscription'}
              </div>
            </div>
          </div>
          {data?.subscription && (
            <button onClick={handlePortal} disabled={portalLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-[#c8d6c0] text-[#183a1d] hover:text-[#183a1d] hover:bg-[#e1eedd]/50 transition-all disabled:opacity-40">
              {portalLoading ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
              Manage Subscription
            </button>
          )}
        </div>

        {/* Usage cards */}
        <div className="rounded-xl border border-[#c8d6c0] p-5" style={{ background: '#e1eedd' }}>
          <div className="text-xs text-[#183a1d]/60 uppercase tracking-wider font-medium mb-4">Usage</div>
          <div className="space-y-4">
            <UsageBar
              used={data?.usage.documents || 0}
              max={data?.limits.maxDocuments || 5}
              label="Documents"
            />
            <UsageBar
              used={data?.usage.users || 0}
              max={data?.limits.maxUsers || 3}
              label="Team Members"
            />
          </div>
        </div>

        {/* Quick stats */}
        <div className="rounded-xl border border-[#c8d6c0] p-5" style={{ background: '#e1eedd' }}>
          <div className="text-xs text-[#183a1d]/60 uppercase tracking-wider font-medium mb-4">Plan Includes</div>
          <div className="space-y-2.5">
            {(PLANS.find(p => p.id === currentPlan)?.features || []).slice(0, 5).map(f => (
              <div key={f} className="flex items-center gap-2.5">
                <Check size={14} className="text-emerald-400 shrink-0" />
                <span className="text-sm text-[#183a1d]/70">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Plans grid */}
      <div>
        <h2 className="text-lg font-bold text-[#183a1d] mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
          {currentPlan === 'FREE' ? 'Choose a Plan' : 'Available Plans'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map(plan => {
            const isCurrent = currentPlan === plan.id
            const Icon = plan.icon
            return (
              <div key={plan.id}
                className="rounded-xl border p-5 relative flex flex-col"
                style={{
                  background: isCurrent ? `${plan.colorDim}` : '#e1eedd',
                  borderColor: isCurrent ? plan.colorBorder : '#c8d6c0',
                }}>
                {plan.popular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: plan.color, color: '#111827' }}>
                    Most Popular
                  </div>
                )}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: plan.colorDim, border: `1px solid ${plan.colorBorder}` }}>
                    <Icon size={16} style={{ color: plan.color }} />
                  </div>
                  <div className="font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {plan.name}
                  </div>
                </div>
                <div className="mb-4">
                  <span className="text-2xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {plan.priceLabel}
                  </span>
                  {plan.subLabel && (
                    <span className="text-sm text-[#183a1d]/60 ml-1">{plan.subLabel}</span>
                  )}
                </div>
                <div className="space-y-2 mb-5 flex-1">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-start gap-2">
                      <Check size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-xs text-[#183a1d]/60">{f}</span>
                    </div>
                  ))}
                </div>
                {isCurrent ? (
                  <div className="px-4 py-2.5 rounded-lg text-sm font-medium text-center border"
                    style={{ borderColor: plan.colorBorder, color: plan.color }}>
                    Current Plan
                  </div>
                ) : plan.id === 'FREE' ? null : plan.id === 'ENTERPRISE' ? (
                  <a href="mailto:hello@tulipds.com"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-[#c8d6c0] text-[#183a1d] hover:text-[#183a1d] hover:bg-[#e1eedd]/50 transition-all">
                    Contact Sales <ArrowUpRight size={14} />
                  </a>
                ) : (
                  <button
                    onClick={() => handleCheckout(plan.id)}
                    disabled={!!checkoutLoading}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-[#183a1d] transition-all hover:opacity-90 disabled:opacity-40"
                    style={{ background: `linear-gradient(135deg, ${plan.color}, ${plan.color}dd)` }}>
                    {checkoutLoading === plan.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <>{currentPlan !== 'FREE' ? 'Switch Plan' : 'Get Started'}<ArrowUpRight size={14} /></>
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Payment History */}
      {data?.invoices && data.invoices.length > 0 && (
        <div className="rounded-xl border border-[#c8d6c0] overflow-hidden" style={{ background: '#e1eedd' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#c8d6c0]">
            <h2 className="font-semibold text-[#183a1d] text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
              Payment History
            </h2>
            {data.subscription && (
              <button onClick={handlePortal} className="text-xs text-[#183a1d] hover:underline">
                View all in Stripe
              </button>
            )}
          </div>
          <div className="divide-y divide-[#c8d6c0]">
            {data.invoices.map(inv => (
              <div key={inv.id} className="flex items-center gap-4 px-5 py-3 hover:bg-[#e1eedd] transition-colors">
                <div className="w-8 h-8 rounded-lg bg-[#e1eedd] flex items-center justify-center shrink-0">
                  <Receipt size={14} className="text-[#183a1d]/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#183a1d]">{inv.number || inv.id.slice(0, 20)}</div>
                  <div className="text-xs text-[#183a1d]/40">
                    {new Date(inv.created * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <div className="text-sm font-medium text-[#183a1d]">
                  {(inv.amount / 100).toFixed(2)} {inv.currency.toUpperCase()}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                  inv.status === 'paid' ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' :
                  inv.status === 'open' ? 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20' :
                  'bg-[#e1eedd] text-[#183a1d]/60 border-[#c8d6c0]'
                }`}>
                  {inv.status}
                </span>
                {inv.invoiceUrl && (
                  <a href={inv.invoiceUrl} target="_blank" rel="noopener noreferrer"
                    className="text-[#183a1d]/30 hover:text-[#183a1d] transition-colors">
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
