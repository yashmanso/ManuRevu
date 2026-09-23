---
id: terminology-consistency
name: Terminology Consistency
description: Catches the same concept named two different ways ("founding team" vs "entrepreneurial team") and acronyms defined late, twice, or with conflicting expansions. Local, no API cost.
tier: structural
scope: full
output: annotation
local: true
---
Runs locally (src/lib/local-skills/terminology-consistency.ts); this body is unused at runtime.

- Acronyms: flags an acronym used before its first definition, and an acronym defined more than once with a different expansion each time.
- Synonym drift: groups content-word bigrams by their shared head noun and flags a head with two or more modifiers that each recur at least twice — the same idea drifting between two names across the manuscript.
