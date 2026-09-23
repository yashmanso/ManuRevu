import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler, readJson, BadRequest } from '@/lib/api-handler'
import { allEvidenceDocs } from '@/lib/evidence-store'
import { findEvidenceOpportunities } from '@/lib/evidence/opportunities'
import { pdfsAsEvidenceDocs } from '@/lib/pdf-indexer'

const Schema = z.object({ text: z.string() })

/**
 * Local "where could my sources strengthen the argument" pass. `text` must be
 * Editor.getPlainText() so every returned `match` is a verbatim substring.
 *
 * Draws on both vaults — markdown papers uploaded here, and PDFs already in
 * the Reference Vault (Settings) — so a paper only needs to be added once.
 */
export const POST = apiHandler(async (req: Request) => {
  const parsed = Schema.safeParse(await readJson(req))
  if (!parsed.success) throw new BadRequest('Expected { text }')
  const docs = [...allEvidenceDocs(), ...pdfsAsEvidenceDocs()]
  return NextResponse.json({ docCount: docs.length, issues: findEvidenceOpportunities(parsed.data.text, docs) })
})
