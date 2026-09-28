---
id: passive-voice
name: Passive Voice
description: "Flags passive-voice constructions (be + past participle) so you can decide, sentence by sentence, whether the passive is deliberate or hiding the actor. Local, no API cost."
tier: structural
scope: full
output: annotation
local: true
---
Runs locally (src/lib/local-skills/passive-voice.ts); this body is unused at runtime.

- Heuristic, not a parser — matches "be" forms followed by a regular or irregular past participle. Advisory only: recasting a passive sentence in the active voice means relocating or inventing the actor, which isn't a safe automatic edit.
- Distinguishes passives with a named actor ("was studied by researchers") from actor-less ones, since the fix differs.
