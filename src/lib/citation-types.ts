export type CitationBackend = 'semantic_scholar' | 'scite'

export type CitationVerdict = 'supports' | 'partial' | 'not_supported' | 'source_unavailable'

export interface ResolvedCitation {
  raw: string          // original citation string e.g. "Smith et al., 2021"
  title?: string
  authors?: string[]
  year?: number
  doi?: string
  abstract?: string
  oa_full_text_url?: string
  full_text?: string   // extracted from local PDF or OA fetch
  source: 'local_pdf' | 'semantic_scholar' | 'scite' | 'unpaywall' | 'none'
  cached_at?: string
}

export interface CitationVerification {
  verdict: CitationVerdict
  rationale: string
  source_span: string | null
  confidence: 'high' | 'medium' | 'low'
  note: string
  backend_used: CitationBackend | 'none'
  source_type: 'full_text' | 'abstract' | 'unavailable'
}
