'use client'
// frontend/app/dashboard/api-portal/ocr/page.jsx

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  FileText, Upload, Loader2, CheckCircle, AlertTriangle,
  XCircle, Download, ExternalLink, Eye, ChevronDown, ChevronUp,
  Shield, Zap, Globe
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL

export default function OcrPage() {
  const [file, setFile]           = useState(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState(null)
  const [showRaw, setShowRaw]     = useState(false)
  const [showJson, setShowJson]   = useState(false)
  const [projectName, setProjectName] = useState('')

  const onDrop = useCallback(accepted => {
    if (accepted[0]) { setFile(accepted[0]); setResult(null); setError(null) }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.tiff', '.webp'],
      'application/pdf': ['.pdf']
    },
    maxSize: 20 * 1024 * 1024,
    multiple: false
  })

  async function process() {
    if (!file) return
    setUploading(true)
    setError(null)
    setResult(null)

    try {
      const token = localStorage.getItem('token')
      const form = new FormData()
      form.append('file', file)
      if (projectName) form.append('projectName', projectName)

      const res = await fetch(`${API}/api/ocr/process`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Processing failed')
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const riskColor = (level) => {
    if (level === 'low') return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
    if (level === 'medium') return 'text-amber-400 bg-amber-400/10 border-amber-400/20'
    return 'text-red-400 bg-red-400/10 border-red-400/20'
  }

  const riskIcon = (level) => {
    if (level === 'low') return <CheckCircle className="w-5 h-5 text-emerald-400" />
    if (level === 'medium') return <AlertTriangle className="w-5 h-5 text-amber-400" />
    return <XCircle className="w-5 h-5 text-red-400" />
  }

  const flagColor = (severity) => {
    if (severity === 'high') return 'border-red-500/30 bg-red-500/5'
    if (severity === 'medium') return 'border-amber-500/30 bg-amber-500/5'
    return 'border-slate-600 bg-slate-800/50'
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">OCR Document Processor</h1>
        <p className="text-slate-400 mt-1">
          Upload any document — handwritten or printed, any language — and get a normalised,
          assessed, and blockchain-anchored verification.
        </p>
      </div>

      {/* Capabilities */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: <Eye className="w-5 h-5 text-emerald-400" />, label: 'Handwriting', desc: 'Reads handwritten text accurately' },
          { icon: <Globe className="w-5 h-5 text-blue-400" />, label: 'Any Language', desc: 'Arabic, English, Hindi, Urdu & more' },
          { icon: <Shield className="w-5 h-5 text-violet-400" />, label: 'Blockchain Proof', desc: 'Hash anchored on Polygon mainnet' },
        ].map(c => (
          <div key={c.label} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex gap-3 items-start">
            {c.icon}
            <div>
              <div className="text-white text-sm font-medium">{c.label}</div>
              <div className="text-slate-400 text-xs">{c.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Upload */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4">
        <h2 className="text-white font-semibold">Upload Document</h2>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
            ${isDragActive ? 'border-emerald-400 bg-emerald-400/5' : 'border-slate-600 hover:border-slate-500'}`}
        >
          <input {...getInputProps()} />
          <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          {file ? (
            <div>
              <p className="text-white font-medium">{file.name}</p>
              <p className="text-slate-400 text-sm mt-1">{(file.size / 1024).toFixed(1)} KB — ready to process</p>
            </div>
          ) : (
            <div>
              <p className="text-slate-300">Drop your document here or click to browse</p>
              <p className="text-slate-500 text-sm mt-1">JPG, PNG, PDF, TIFF, WEBP — up to 20MB</p>
            </div>
          )}
        </div>

        <input
          type="text"
          placeholder="Project name (optional — helps with assessment context)"
          value={projectName}
          onChange={e => setProjectName(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500"
        />

        <button
          onClick={process}
          disabled={!file || uploading}
          className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          {uploading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing — OCR → AI Analysis → Blockchain Hash...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              Process Document
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex gap-3">
          <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">

          {/* Assessment Banner */}
          <div className={`border rounded-xl p-5 flex gap-4 items-start ${riskColor(result.assessment.riskLevel)}`}>
            {riskIcon(result.assessment.riskLevel)}
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-white capitalize">
                  {result.assessment.riskLevel} Risk — Score {result.assessment.riskScore}/100
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium uppercase
                  ${result.assessment.recommendation === 'approve' ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' :
                    result.assessment.recommendation === 'review' ? 'text-amber-400 border-amber-400/30 bg-amber-400/10' :
                    'text-red-400 border-red-400/30 bg-red-400/10'}`}>
                  {result.assessment.recommendation}
                </span>
              </div>
              <p className="text-slate-300 text-sm mt-1">{result.assessment.summary}</p>
              <p className="text-slate-400 text-xs mt-1">{result.assessment.recommendationReason}</p>
            </div>
          </div>

          {/* Doc Info */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4">Document Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                ['Type', result.documentType?.replace('_', ' ').toUpperCase()],
                ['Language', result.detectedLanguage?.toUpperCase()],
                ['OCR Confidence', result.confidence + '%'],
                ['Completeness', result.assessment.completenessScore + '%'],
              ].map(([k, v]) => (
                <div key={k}>
                  <span className="text-slate-400">{k}</span>
                  <span className="text-white font-medium ml-2">{v}</span>
                </div>
              ))}
            </div>

            {/* Purpose */}
            {result.assessment.purpose && (
              <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
                <p className="text-slate-400 text-xs font-medium mb-1">PURPOSE</p>
                <p className="text-slate-300 text-sm">{result.assessment.purpose}</p>
              </div>
            )}
          </div>

          {/* Positives */}
          {result.assessment.positives?.length > 0 && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5">
              <h3 className="text-emerald-400 font-semibold mb-3 text-sm">✓ Positive Indicators</h3>
              <ul className="space-y-1">
                {result.assessment.positives.map((p, i) => (
                  <li key={i} className="text-slate-300 text-sm flex gap-2">
                    <span className="text-emerald-400">•</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Flags */}
          {result.assessment.flags?.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-3">Flags & Observations</h3>
              <div className="space-y-3">
                {result.assessment.flags.map((flag, i) => (
                  <div key={i} className={`border rounded-lg p-4 ${flagColor(flag.severity)}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded
                        ${flag.severity === 'high' ? 'bg-red-500/20 text-red-400' :
                          flag.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-slate-600 text-slate-300'}`}>
                        {flag.severity}
                      </span>
                      <span className="text-white text-sm font-medium">{flag.field}</span>
                    </div>
                    <p className="text-slate-300 text-sm">{flag.issue}</p>
                    {flag.recommendation && (
                      <p className="text-slate-400 text-xs mt-1">→ {flag.recommendation}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hash & Blockchain */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-violet-400" />
              Blockchain Verification
            </h3>
            <div className="space-y-2">
              <div>
                <p className="text-slate-400 text-xs mb-1">SHA-256 HASH</p>
                <p className="text-slate-300 text-xs font-mono break-all bg-slate-800 p-2 rounded">{result.hash}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-amber-400 text-sm">Queued for Polygon mainnet anchor</span>
              </div>
            </div>
          </div>

          {/* Extracted Fields */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
            <button
              onClick={() => setShowJson(!showJson)}
              className="w-full flex items-center justify-between text-white font-semibold"
            >
              <span>Extracted & Normalised Fields</span>
              {showJson ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showJson && (
              <pre className="mt-4 text-xs text-slate-300 font-mono bg-slate-900 p-4 rounded-lg overflow-auto max-h-96">
                {JSON.stringify(result.normalisedDocument, null, 2)}
              </pre>
            )}
          </div>

          {/* Raw Text */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
            <button
              onClick={() => setShowRaw(!showRaw)}
              className="w-full flex items-center justify-between text-white font-semibold"
            >
              <span>Raw OCR Text</span>
              {showRaw ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showRaw && (
              <pre className="mt-4 text-xs text-slate-400 font-mono bg-slate-900 p-4 rounded-lg overflow-auto max-h-64 whitespace-pre-wrap">
                {result.rawTextPreview}
              </pre>
            )}
          </div>

          {/* Download */}
          <div className="flex gap-3">
            <button className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors">
              <Download className="w-4 h-4" />
              Download Normalised PDF
            </button>
            <button className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors">
              <ExternalLink className="w-4 h-4" />
              View on Polygonscan
            </button>
          </div>

        </div>
      )}
    </div>
  )
}
