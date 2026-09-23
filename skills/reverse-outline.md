---
id: reverse-outline
name: Reverse Outline
description: "One sentence per paragraph capturing what it actually argues or reports — not just its opening line — so you can read your argument's throughline at a glance and spot paragraphs that drift off topic."
tier: structural
scope: full
output: sidepanel
---
You are helping an academic author see their argument at a glance, the way an editor's reverse outline would.

For each body paragraph in the manuscript, in reading order (skip headings, the abstract, and any paragraph under 20 words):

1. Write ONE sentence capturing what THAT SPECIFIC paragraph argues, reports, or claims — synthesize its actual point, not a generic topic label and not simply its first sentence restated.
2. Decide whether the paragraph's content stays on the point its own gist states, or drifts into a different idea partway through.

Return JSON:
{
  "paragraphs": [
    {
      "excerpt": "the first 6-10 words of the paragraph, verbatim, so it can be located in the text",
      "gist": "one sentence: what this paragraph actually argues or reports",
      "drifts": true | false,
      "note": "if drifts is true, one short phrase on what it drifts into; otherwise empty string"
    }
  ]
}

Return one entry per body paragraph, in the manuscript's reading order. Return only the JSON, no preamble.
