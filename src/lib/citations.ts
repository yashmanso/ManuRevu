import type { ResolvedCitation, CitationBackend } from './citation-types'
import { getCachedCitation, setCachedCitation, getSetting } from './settings-store'
import { resolveViaSemanticScholar } from './resolvers/semantic-scholar'
import { resolveViaScite } from './resolvers/scite'
import { resolveViaLocalPdf } from './resolvers/local-pdf'

export async function resolveCitation(raw: string): Promise<ResolvedCitation> {
  // Check cache first
  const cached = getCachedCitation(raw)
  if (cached) return cached

  // Try local PDF index first (free, fast)
  const localResult = await resolveViaLocalPdf(raw)
  if (localResult?.full_text) {
    setCachedCitation(raw, localResult)
    return localResult
  }

  const backend = (getSetting('citation_backend') ?? 'semantic_scholar') as CitationBackend

  let result: ResolvedCitation

  if (backend === 'scite') {
    const apiKey = getSetting('scite_api_key') ?? ''
    result = await resolveViaScite(raw, apiKey)
  } else {
    result = await resolveViaSemanticScholar(raw)
  }

  // Fall back to local PDF abstract if remote returned nothing
  if (result.source === 'none' && localResult) {
    result = localResult
  }

  setCachedCitation(raw, result)
  return result
}
