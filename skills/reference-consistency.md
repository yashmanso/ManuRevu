---
id: reference-consistency
name: Reference Consistency
description: Locally checks in-text citations against the reference list — flags citations with no matching entry, entries never cited, duplicate entries, author/year mismatches, and likely misspelled author names. No API cost.
tier: structural
scope: full
output: annotation
local: true
---
This skill runs entirely locally (deterministic regex/set-diff, no LLM call). This body is unused at runtime but kept for schema validation and documentation:

- Cited in-text but missing from the reference list
- Listed in the bibliography but never cited
- Duplicate bibliography entries for the same author/year
- Author cited with a year that doesn't match their bibliography entry
- A near-identical author name split between an in-text citation and a bibliography entry (same year, small edit distance) — reported as one likely misspelling instead of two unrelated discrepancies
