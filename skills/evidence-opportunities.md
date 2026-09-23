---
id: evidence-opportunities
name: Evidence Opportunities
description: "Finds where papers in your Evidence vault could back an uncited claim or extend an argument, and points to places to add them without breaking the flow. Local, no API cost."
tier: writing
scope: full
output: annotation
local: true
---
Runs locally (src/lib/evidence/opportunities.ts); this body is unused at runtime.

- Retrieves passages from the markdown papers in the Evidence vault that are on topic for each body paragraph (TF-IDF, no LLM).
- If the closest sentence is a claim with at most one citation, Accept appends the citation to it.
- Otherwise it proposes a flow-safe spot for a new sentence: never in front of a sentence that leans on the previous one ("This…", "However…", "Second…"), and a new paragraph when the current one is already long.
- Skips abstract, methods and results sections, and the reference list.
