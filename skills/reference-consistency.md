---
id: reference-consistency
name: Reference Consistency
description: Locally checks in-text citations against the reference list — flags citations with no matching entry, entries never cited, duplicate entries, and author/year mismatches. No API cost.
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
