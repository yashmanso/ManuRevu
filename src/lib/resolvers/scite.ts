import type { ResolvedCitation } from '../citation-types'

// scite.ai Smart Citations API
// Docs: https://scite.ai/api-docs
// User must provide API key in settings (key: 'scite_api_key')

interface SciteSearchResult {
  doi?: string
  title?: string
  year?: number
  authors?: string[]
  abstract?: string
}

export async function resolveViaScite(citation: string, apiKey: string): Promise<ResolvedCitation> {
  if (!apiKey) {
    return { raw: citation, source: 'none' }
  }

  try {
    // Search for the paper by citation string
    const searchRes = await fetch(
      `https://api.scite.ai/search/papers?q=${encodeURIComponent(citation)}&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      }
    )

    if (searchRes.status === 401) {
      console.warn('[scite] Invalid API key')
      return { raw: citation, source: 'none' }
    }

    if (!searchRes.ok) {
      return { raw: citation, source: 'none' }
    }

    const data = await searchRes.json() as { hits?: SciteSearchResult[] }
    const paper = data.hits?.[0]

    if (!paper) {
      return { raw: citation, source: 'none' }
    }

    return {
      raw: citation,
      title: paper.title,
      authors: paper.authors,
      year: paper.year,
      doi: paper.doi,
      abstract: paper.abstract,
      source: 'scite',
    }
  } catch {
    return { raw: citation, source: 'none' }
  }
}
