---
id: weak-verbs
name: Weak Verbs
description: "Restores actions to verbs and deletes empty verbs (Williams, Style): \"make a decision\" -> \"decide\", \"conduct an analysis\" -> \"analyze\". Local, no API cost."
tier: structural
scope: full
output: annotation
local: true
---
Runs locally (src/lib/local-skills/weak-verbs.ts); this body is unused at runtime.

- A weak verb (make/take/give/conduct/perform/provide/reach/draw/put/place/engage/have) plus a nominalized noun almost always has a plain verb hiding inside it.
- Matches ~20 common academic phrasings, each with a concrete one-word replacement, tense-matched to the weak verb's own inflection.
