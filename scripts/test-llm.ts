import { runLLM, STRUCTURAL_MODEL, WRITING_MODEL } from '../src/lib/llm'
import { z } from 'zod'

async function main() {
  console.log('=== ManuRevu LLM Tier Test ===\n')

  // Test 1: structural tier, plain text
  console.log(`Testing STRUCTURAL tier (${STRUCTURAL_MODEL})...`)
  try {
    const { result, usage, latency_ms } = await runLLM({
      tier: 'structural',
      system: 'You are a helpful assistant. Be concise.',
      user: 'Respond with exactly: "Structural tier OK"',
    })
    console.log(`  Response: ${result}`)
    console.log(`  Tokens: ${usage.prompt_tokens} in / ${usage.completion_tokens} out`)
    console.log(`  Cost: $${usage.estimated_cost_usd.toFixed(6)}`)
    console.log(`  Latency: ${latency_ms}ms`)
    console.log('  ✓ PASS\n')
  } catch (err) {
    console.error(`  ✗ FAIL: ${err}`)
    process.exit(1)
  }

  // Test 2: writing tier, plain text
  console.log(`Testing WRITING tier (${WRITING_MODEL})...`)
  try {
    const { result, usage, latency_ms } = await runLLM({
      tier: 'writing',
      system: 'You are a helpful assistant. Be concise.',
      user: 'Respond with exactly: "Writing tier OK"',
    })
    console.log(`  Response: ${result}`)
    console.log(`  Tokens: ${usage.prompt_tokens} in / ${usage.completion_tokens} out`)
    console.log(`  Cost: $${usage.estimated_cost_usd.toFixed(6)}`)
    console.log(`  Latency: ${latency_ms}ms`)
    console.log('  ✓ PASS\n')
  } catch (err) {
    console.error(`  ✗ FAIL: ${err}`)
    process.exit(1)
  }

  // Test 3: structural tier with Zod schema
  console.log('Testing JSON schema output (structural tier)...')
  const TestSchema = z.object({
    status: z.string(),
    tier: z.string(),
  })
  try {
    const { result, usage, latency_ms } = await runLLM({
      tier: 'structural',
      system: 'You respond only in valid JSON.',
      user: 'Return a JSON object with keys "status" (value: "ok") and "tier" (value: "structural")',
      schema: TestSchema,
    })
    console.log(`  Response: ${JSON.stringify(result)}`)
    console.log(`  Tokens: ${usage.prompt_tokens} in / ${usage.completion_tokens} out`)
    console.log(`  Cost: $${usage.estimated_cost_usd.toFixed(6)}`)
    console.log(`  Latency: ${latency_ms}ms`)
    console.log('  ✓ PASS\n')
  } catch (err) {
    console.error(`  ✗ FAIL: ${err}`)
    process.exit(1)
  }

  console.log('All tests passed.')
}

main().catch(console.error)
