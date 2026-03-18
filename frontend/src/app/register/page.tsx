'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

type ProductType = 'NGO' | 'DON' | 'API'

const products = [
  {
    type: 'NGO' as ProductType,
    shortLabel: 'NGO',
    icon: '🌱',
    accent: '#00C896',
    accentDim: 'rgba(0,200,150,0.12)',
    accentBorder: 'rgba(0,200,150,0.25)',
    redirect: '/dashboard',
  },
  {
    type: 'DON' as ProductType,
    shortLabel: 'DONOR',
    icon: '🏛️',
    accent: '#3B82F6',
    accentDim: 'rgba(59,130,246,0.12)',
    accentBorder: 'rgba(59,130,246,0.25)',
    redirect: '/donor',
  },
  {
    type: 'API' as ProductType,
    shortLabel: 'API',
    icon: '⚡',
    accent: '#A855F7',
    accentDim: 'rgba(168,85,247,0.12)',
    accentBorder: 'rgba(168,85,247,0.25)',
    redirect: '/developer',
  },
]

const ROLES: Record<ProductType, string[]> = {
  NGO: [
    'Executive Director','Finance Officer','Project Manager',
    'Programme Officer','M&E Officer','Communications Officer',
    'Operations Manager','Board Member','Other',
  ],
  DON: [
    'Portfolio Manager','Grants Officer','Investment Analyst',
    'Compliance Officer','Director','Other',
  ],
  API: [
    'Developer','CTO / Technical Lead','Product Manager',
    'Solutions Architect','Other',
  ],
}

import { COUNTRIES } from '@/lib/ngo-categories'

export default function RegisterPage() {
  const router = useRouter()
  const t = useTranslations('register')
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedProduct, setSelectedProduct] = useState<typeof products[0] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)

  const productLabels: Record<ProductType, string> = { NGO: t('ngoLabel'), DON: t('donorLabel'), API: t('apiLabel') }
  const productDescs: Record<ProductType, string> = { NGO: t('ngoDesc'), DON: t('donorDesc'), API: t('apiDesc') }

  const [form, setForm] = useState({
    firstName: '', lastName: '', role: '', email: '',
    password: '', confirmPassword: '', organisationName: '', country: '',
  })

  useEffect(() => { setMounted(true) }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleProductSelect = (product: typeof products[0]) => {
    setSelectedProduct(product)
    setStep(2)
  }

  const handleSubmit = async () => {
    if (!selectedProduct) return
    const { firstName, lastName, role, email, password, confirmPassword, organisationName, country } = form
    if (!firstName || !lastName || !role || !email || !password || !organisationName || !country) {
      setError(t('fillAllFields'))
      return
    }
    if (password !== confirmPassword) { setError(t('passwordsNoMatch')); return }
    if (password.length < 8) { setError(t('passwordMinLength')); return }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${firstName} ${lastName}`,  // backend expects 'name'
          firstName,
          lastName,
          role,
          email,
          password,
          organisationName,                  // backend expects 'organisationName'
          country,
          tenantType: selectedProduct.type,  // backend expects 'tenantType'
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || data.message || t('registrationFailed'))
        setLoading(false)
        return
      }

      if (data.accessToken) {
        localStorage.setItem('tulip_token', data.accessToken)
        localStorage.setItem('tulip_refresh', data.refreshToken)
        if (data.user) localStorage.setItem('tulip_user', JSON.stringify(data.user))
      }

      // NGO accounts go to setup wizard; others go to their dashboards
      router.push(selectedProduct.type === 'NGO' ? '/setup' : selectedProduct.redirect)
    } catch {
      setError(t('serverError'))
      setLoading(false)
    }
  }

  if (!mounted) return null

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&family=Instrument+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg:#070B0F; --surface:#0C1117; --surface2:#111820;
          --border:#E5E7EB; --border2:#E5E7EB;
          --text:#E2E8F0; --text2:#64748B; --text3:#3A4A5C;
          --fd:'Bricolage Grotesque',sans-serif; --fb:'Instrument Sans',sans-serif;
        }
        html,body { min-height:100vh; background:var(--bg); }
        .wrap { min-height:100vh; display:grid; grid-template-columns:440px 1fr; font-family:var(--fb); color:var(--text); }
        .panel-left { background:var(--surface); border-right:1px solid var(--border); padding:40px 44px; display:flex; flex-direction:column; position:relative; overflow:hidden; }
        .panel-left::before { content:''; position:absolute; top:-300px; left:-200px; width:700px; height:700px; background:radial-gradient(circle,rgba(0,200,150,.055) 0%,transparent 65%); pointer-events:none; }
        .logo { display:flex; align-items:center; gap:10px; font-family:var(--fd); font-size:22px; font-weight:800; color:#fff; text-decoration:none; position:relative; z-index:1; }
        .logo-mark { width:34px; height:34px; background:linear-gradient(135deg,#00C896,#00A37A); border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:16px; }
        .left-body { flex:1; display:flex; flex-direction:column; justify-content:center; padding:48px 0 32px; position:relative; z-index:1; }
        .left-eyebrow { font-size:11px; font-weight:500; letter-spacing:2px; text-transform:uppercase; color:#00C896; margin-bottom:20px; }
        .left-heading { font-family:var(--fd); font-size:40px; font-weight:800; line-height:1.06; letter-spacing:-1.5px; color:#fff; margin-bottom:18px; }
        .left-heading em { font-style:normal; background:linear-gradient(135deg,#00C896 0%,#3B82F6 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .left-sub { font-size:14px; color:var(--text2); line-height:1.75; max-width:320px; margin-bottom:40px; }
        .proof-list { display:flex; flex-direction:column; gap:14px; }
        .proof-item { display:flex; align-items:flex-start; gap:12px; }
        .proof-check { width:20px; height:20px; border-radius:50%; background:rgba(0,200,150,.15); border:1px solid rgba(0,200,150,.3); display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; font-size:10px; color:#00C896; }
        .proof-text { font-size:13px; color:var(--text2); line-height:1.5; }
        .proof-text strong { color:var(--text); font-weight:500; }
        .left-footer { font-size:12px; color:var(--text3); position:relative; z-index:1; }
        .left-footer a { color:#00C896; text-decoration:none; }
        .left-footer a:hover { text-decoration:underline; }
        .panel-right { background:var(--bg); padding:32px 56px; display:flex; flex-direction:column; justify-content:center; overflow-y:auto; }
        .right-inner { max-width:520px; width:100%; }
        .steps { display:flex; align-items:center; margin-bottom:32px; }
        .step-item { display:flex; align-items:center; gap:8px; font-size:12px; font-weight:500; color:var(--text3); }
        .step-item.active { color:var(--text); }
        .step-item.done { color:#00C896; }
        .step-num { width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; border:1px solid var(--border2); background:var(--surface2); color:var(--text3); transition:all .3s; }
        .step-item.active .step-num { background:var(--text); color:var(--bg); border-color:var(--text); }
        .step-item.done .step-num { background:rgba(0,200,150,.15); color:#00C896; border-color:rgba(0,200,150,.4); }
        .step-connector { width:32px; height:1px; background:var(--border); margin:0 4px; }
        .step-connector.done { background:rgba(0,200,150,.25); }
        .form-heading { font-family:var(--fd); font-size:26px; font-weight:700; letter-spacing:-.5px; color:#fff; margin-bottom:6px; }
        .form-sub { font-size:14px; color:var(--text2); margin-bottom:28px; }
        .product-list { display:flex; flex-direction:column; gap:10px; }
        .product-btn { display:flex; align-items:center; gap:16px; padding:16px 18px; background:var(--surface); border:1px solid var(--border); border-radius:14px; cursor:pointer; transition:all .18s; text-align:left; width:100%; color:var(--text); font-family:var(--fb); }
        .product-icon-wrap { width:46px; height:46px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0; }
        .product-btn-body { flex:1; }
        .product-btn-name { font-family:var(--fd); font-size:15px; font-weight:700; color:#fff; margin-bottom:3px; }
        .product-btn-desc { font-size:12px; color:var(--text2); line-height:1.5; }
        .product-btn-arrow { font-size:18px; color:var(--text3); transition:all .18s; }
        .btn-back { display:flex; align-items:center; gap:6px; background:none; border:none; color:var(--text2); font-size:13px; cursor:pointer; padding:0; font-family:var(--fb); margin-bottom:24px; transition:color .15s; }
        .btn-back:hover { color:var(--text); }
        .selected-tag { display:inline-flex; align-items:center; gap:7px; padding:5px 12px 5px 8px; border-radius:100px; font-size:12px; font-weight:600; margin-bottom:20px; border:1px solid; font-family:var(--fd); }
        .section-label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:1px; color:var(--text3); margin:16px 0 10px; display:flex; align-items:center; gap:8px; }
        .section-label::after { content:''; flex:1; height:1px; background:var(--border); }
        .field-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .field { display:flex; flex-direction:column; gap:6px; margin-bottom:11px; }
        .field label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.8px; color:var(--text2); }
        .field input, .field select { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:11px 13px; font-size:14px; color:var(--text); font-family:var(--fb); outline:none; transition:all .18s; width:100%; appearance:none; -webkit-appearance:none; }
        .field input::placeholder { color:var(--text3); }
        .field input:focus, .field select:focus { border-color:rgba(0,200,150,.4); background:rgba(0,200,150,.025); box-shadow:0 0 0 3px rgba(0,200,150,.07); }
        .field select option { background:#0C1117; color:var(--text); }
        .select-wrap { position:relative; }
        .select-wrap::after { content:'▾'; position:absolute; right:13px; top:50%; transform:translateY(-50%); color:var(--text3); pointer-events:none; font-size:12px; }
        .error-msg { background:rgba(239,68,68,.07); border:1px solid rgba(239,68,68,.2); border-radius:8px; padding:10px 14px; font-size:13px; color:#FCA5A5; margin-bottom:14px; display:flex; align-items:center; gap:8px; }
        .btn-submit { width:100%; padding:13px; border:none; border-radius:10px; font-size:14px; font-weight:700; font-family:var(--fd); cursor:pointer; transition:all .2s; margin-top:6px; display:flex; align-items:center; justify-content:center; gap:8px; }
        .btn-submit:disabled { opacity:.5; cursor:not-allowed; }
        .spinner { width:16px; height:16px; border:2px solid rgba(0,0,0,.2); border-top-color:rgba(0,0,0,.7); border-radius:50%; animation:spin .7s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }
        .signin-row { text-align:center; margin-top:20px; font-size:13px; color:var(--text3); }
        .signin-row a { color:#00C896; text-decoration:none; font-weight:500; }
        .signin-row a:hover { text-decoration:underline; }
        .divider { display:flex; align-items:center; gap:12px; margin:16px 0; font-size:11px; color:var(--text3); text-transform:uppercase; letter-spacing:1px; }
        .divider::before, .divider::after { content:''; flex:1; height:1px; background:var(--border); }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .animate-in { animation:fadeUp .3s ease forwards; }
        @media(max-width:960px){.wrap{grid-template-columns:1fr}.panel-left{display:none}.panel-right{padding:40px 24px}.right-inner{max-width:100%}}
      `}</style>

      <div className="wrap">
        {/* LEFT PANEL */}
        <div className="panel-left">
          <a href="/" className="logo">
            <img src="/logo.svg" alt="sealayer" style={{ height: '34px' }} />
          </a>
          <div className="left-body">
            <div className="left-eyebrow">{t('eyebrow')}</div>
            <h1 className="left-heading">{t('heading')}<br /><em>{t('headingEmphasis')}</em><br />{t('headingEnd')}</h1>
            <p className="left-sub">{t('subtext')}</p>
            <div className="proof-list">
              {[
                [t('proof1Title'), t('proof1Desc')],
                [t('proof2Title'), t('proof2Desc')],
                [t('proof3Title'), t('proof3Desc')],
                [t('proof4Title'), t('proof4Desc')],
              ].map(([title, desc]) => (
                <div className="proof-item" key={title}>
                  <div className="proof-check">✓</div>
                  <div className="proof-text"><strong>{title}</strong> — {desc}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="left-footer">{t('alreadyHaveAccount')} <a href="/login">{t('signIn')} →</a></div>
        </div>

        {/* RIGHT PANEL */}
        <div className="panel-right">
          <div className="right-inner">
            <div className="steps">
              <div className={`step-item ${step === 1 ? 'active' : 'done'}`}>
                <div className="step-num">{step === 1 ? '1' : '✓'}</div>
                {t('step1')}
              </div>
              <div className={`step-connector ${step === 2 ? 'done' : ''}`} />
              <div className={`step-item ${step === 2 ? 'active' : ''}`}>
                <div className="step-num">2</div>
                {t('step2')}
              </div>
            </div>

            {/* STEP 1 — CHOOSE PRODUCT */}
            {step === 1 && (
              <div className="animate-in">
                <h2 className="form-heading">{t('createYourAccount')}</h2>
                <p className="form-sub">{t('chooseAccountType')}</p>
                <div className="product-list">
                  {products.map(p => (
                    <button key={p.type} className="product-btn"
                      onClick={() => handleProductSelect(p)}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLElement
                        el.style.borderColor = p.accentBorder
                        el.style.background = p.accentDim
                        el.style.transform = 'translateX(3px)'
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLElement
                        el.style.borderColor = '#E5E7EB'
                        el.style.background = 'var(--surface)'
                        el.style.transform = 'translateX(0)'
                      }}
                    >
                      <div className="product-icon-wrap" style={{ background: p.accentDim, border: `1px solid ${p.accentBorder}` }}>{p.icon}</div>
                      <div className="product-btn-body">
                        <div className="product-btn-name">{productLabels[p.type]}</div>
                        <div className="product-btn-desc">{productDescs[p.type]}</div>
                      </div>
                      <div className="product-btn-arrow">→</div>
                    </button>
                  ))}
                </div>
                <div className="divider">{t('or')}</div>
                <div className="signin-row">{t('alreadyHaveAccount')} <a href="/login">{t('signIn')}</a></div>
              </div>
            )}

            {/* STEP 2 — FILL DETAILS */}
            {step === 2 && selectedProduct && (
              <div className="animate-in">
                <button className="btn-back" onClick={() => setStep(1)}>← {t('back')}</button>
                <div className="selected-tag" style={{ background: selectedProduct.accentDim, borderColor: selectedProduct.accentBorder, color: selectedProduct.accent }}>
                  <span>{selectedProduct.icon}</span>{productLabels[selectedProduct.type]}
                </div>
                <h2 className="form-heading">{t('yourDetails')}</h2>
                <p className="form-sub">{t('setupOrgAccount')}</p>

                <div className="section-label">{t('personalInfo')}</div>
                <div className="field-row">
                  <div className="field">
                    <label>{t('firstName')}</label>
                    <input name="firstName" type="text" placeholder="Jane" value={form.firstName} onChange={handleChange} autoComplete="given-name" />
                  </div>
                  <div className="field">
                    <label>{t('lastName')}</label>
                    <input name="lastName" type="text" placeholder="Doe" value={form.lastName} onChange={handleChange} autoComplete="family-name" />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>{t('yourRole')}</label>
                    <div className="select-wrap">
                      <select name="role" value={form.role} onChange={handleChange}>
                        <option value="">{t('selectRole')}</option>
                        {ROLES[selectedProduct.type].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="field">
                    <label>{t('emailAddress')}</label>
                    <input name="email" type="email" placeholder="jane@org.com" value={form.email} onChange={handleChange} autoComplete="email" />
                  </div>
                </div>

                <div className="section-label">{t('organisation')}</div>
                <div className="field-row">
                  <div className="field">
                    <label>{t('organisationName')}</label>
                    <input name="organisationName" type="text" placeholder="Your NGO / Foundation" value={form.organisationName} onChange={handleChange} />
                  </div>
                  <div className="field">
                    <label>{t('country')}</label>
                    <div className="select-wrap">
                      <select name="country" value={form.country} onChange={handleChange}>
                        <option value="">{t('selectCountry')}</option>
                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="section-label">{t('security')}</div>
                <div className="field-row">
                  <div className="field">
                    <label>{t('password')}</label>
                    <input name="password" type="password" placeholder={t('minChars')} value={form.password} onChange={handleChange} autoComplete="new-password" />
                  </div>
                  <div className="field">
                    <label>{t('confirmPassword')}</label>
                    <input name="confirmPassword" type="password" placeholder={t('repeatPassword')} value={form.confirmPassword} onChange={handleChange} autoComplete="new-password" />
                  </div>
                </div>

                {error && <div className="error-msg"><span>⚠</span> {error}</div>}

                <button className="btn-submit" onClick={handleSubmit} disabled={loading}
                  style={{ background: selectedProduct.accent, color: selectedProduct.type === 'NGO' ? '#070B0F' : '#fff' }}
                  onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
                >
                  {loading ? <><div className="spinner" /> {t('creatingAccount')}</> : t('createAccount', { type: selectedProduct.shortLabel })}
                </button>

                <div className="signin-row">{t('alreadyHaveAccount')} <a href="/login">{t('signIn')}</a></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
