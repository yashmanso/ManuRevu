---
id: interrupted-sentences
name: Interrupted Sentences
description: "Puts subjects and verbs together, verbs and objects together (Williams, Style): flags a long clause wedged between two things that belong together. Local, no API cost."
tier: structural
scope: full
output: annotation
local: true
---
Runs locally (src/lib/local-skills/interrupted-sentences.ts); this body is unused at runtime.

- Heuristic, not a parser — flags a short phrase, comma, a clause of 10+ words, then another comma, which is the shape of the common case: a non-restrictive relative clause or appositive dropped mid-sentence.
- Advisory only: moving or splitting the interrupting clause is a rewrite, not a safe automatic edit.
