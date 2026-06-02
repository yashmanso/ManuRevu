import type { ResolvedCitation } from '../citation-types'

const SS_BASE = 'https://api.semanticscholar.org/graph/v1'

interface SSPaper {
  paperId: string
  title?: string
  year?: number
  authors?: { name: string }[]
  externalIds?: { DOI?: string }
  abstract?: string
  openAccessPdf?: { url: string }
}

async function searchPaper(query: string): Promise<SSPaper | null> {
  const url = `${SS_BASE}/paper/search?query=${encodeURIComponent(query)}&fields=title,year,authors,externalIds,abstract,openAccessPdf&limit=1`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ManuRevu/1.0 (academic manuscript tool)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json() as { data?: SSPaper[] }
    return data.data?.[0] ?? null
  } catch { return null }
}

async function fetchOAText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    const text = await res.text()
    // Strip HTML tags if HTML was returned
    return text.replace(/<[^>]+>/g, ' ').slice(0, 8000)
  } catch { return null }
}

export async function resolveViaSemanticScholar(citation: string): Promise<ResolvedCitation> {
  const paper = await searchPaper(citation)
  if (!paper) {
    return { raw: citation, source: 'none' }
  }

  let fullText: string | undefined
  let oaUrl: string | undefined

  if (paper.openAccessPdf?.url) {
    oaUrl = paper.openAccessPdf.url
    // Try Unpaywall as OA full-text fallback via DOI
  } else if (paper.externalIds?.DOI) {
    const doi = paper.externalIds.DOI
    try {
      const uwRes = await fetch(
        `https://api.unpaywall.org/v2/${doi}?email=manurevu@localhost`,
        { signal: AbortSignal.timeout(6000) }
      )
      if (uwRes.ok) {
        const uwData = await uwRes.json() as { best_oa_location?: { url_for_pdf?: string } }
        oaUrl = uwData.best_oa_location?.url_for_pdf
      }
    } catch { /* ignore */ }
  }

  if (oaUrl) {
    fullText = await fetchOAText(oaUrl) ?? undefined
  }

  return {
    raw: citation,
    title: paper.title,
    authors: paper.authors?.map(a => a.name),
    year: paper.year,
    doi: paper.externalIds?.DOI,
    abstract: paper.abstract,
    oa_full_text_url: oaUrl,
    full_text: fullText,
    source: fullText ? 'unpaywall' : 'semantic_scholar',
  }
}
