import type { TourStep } from '@/components/GuidedTour'
import { Kbd, Shortcut, PaletteKey, KeyCombo } from '@/components/ActionsPanel'
import { modifierParts } from '@/lib/action-catalog'

export function buildTourSteps(isMac: boolean): TourStep[] {
  return [
    {
      title: 'Welcome to ManuRevu',
      body: (
        <>
          <p>A review desk for your manuscript. It reads your draft and suggests line edits, consistency fixes, evidence to add, and structural feedback.</p>
          <p>Nothing changes in your text until you accept it. This tour takes about a minute.</p>
        </>
      ),
    },
    {
      target: 'projects', placement: 'right',
      title: 'Projects',
      body: <p>Each manuscript is a project. Everything saves automatically, so you can switch between projects at any time.</p>,
    },
    {
      target: 'import', placement: 'bottom',
      title: 'Bring your manuscript in',
      body: <p>Import a <b>.docx</b>, <b>.md</b> or <b>.txt</b> file, or paste straight into the editor.</p>,
    },
    {
      target: 'editor', placement: 'right',
      title: 'The editor',
      body: (
        <>
          <p>Write and edit here. Suggestions show up as colored highlights; hover one to accept or reject it in place.</p>
          <p>Type <Kbd>/</Kbd> after a space for a quick menu of actions without leaving the keyboard.</p>
        </>
      ),
    },
    {
      target: 'actions', placement: 'right',
      title: 'Every action, always in view',
      body: (
        <>
          <p>All actions, grouped by what they do. Click one to run it on your manuscript.</p>
          <p className="flex flex-wrap items-center gap-1.5">
            Each has a shortcut: hold <KeyCombo parts={modifierParts(isMac)} /> and press its letter, e.g. <Shortcut letter="E" isMac={isMac} /> for Weak Verbs.
          </p>
          <p><b>AI</b> marks actions that use your API key; the rest are free and run on this computer. Hover an action and click <b>?</b> to see what it does.</p>
        </>
      ),
    },
    {
      target: 'palette-button', placement: 'bottom',
      title: 'See them all at once',
      body: (
        <p className="flex flex-wrap items-center gap-1.5">
          Press <PaletteKey isMac={isMac} /> (or click here) for a grid of every action with a one-line explanation. Type to filter, Enter to run.
        </p>
      ),
    },
    {
      target: 'stats', placement: 'bottom',
      title: 'Stats and scope',
      body: (
        <>
          <p>Live counts for words, sentences and citations. The long-sentence threshold is adjustable.</p>
          <p>Open <b>Sections</b> to limit AI actions to the parts you pick — faster, cheaper and more focused.</p>
        </>
      ),
    },
    {
      target: 'sidebar', placement: 'left',
      title: 'The review queue',
      body: (
        <>
          <p>Suggestions land here, grouped by action. <b>Accept</b> applies the change, <b>Reject</b> dismisses it, <b>Jump</b> takes you to it.</p>
          <p>Before every run a version is saved, so any batch of edits can be undone from <b>Versions</b>.</p>
        </>
      ),
    },
    {
      target: 'tabs', placement: 'left',
      title: 'More tools',
      body: (
        <ul className="list-disc pl-4 space-y-1">
          <li><b>Evidence</b>: add the papers you want to cite; it finds where they back your claims.</li>
          <li><b>Reviewers</b>: paste reviewer comments, link each to a passage, track status, and draft the response letter.</li>
          <li><b>History</b>, <b>Knowledge</b> and <b>Versions</b>: every run, saved suggestions, and snapshots.</li>
        </ul>
      ),
    },
    {
      target: 'settings', placement: 'bottom',
      title: 'Settings',
      body: <p>Pick your AI provider (OpenRouter, or the Claude API directly) and paste your key. Free actions work without one. Your PDF library lives here too.</p>,
    },
    {
      title: 'You’re set',
      body: (
        <>
          <p>A good first pass: run the free <b>Sentence polish</b> actions, then <b>Reverse Outline</b> to check the argument’s throughline.</p>
          <p>The showcase walks through every action with a live example.</p>
        </>
      ),
    },
  ]
}
