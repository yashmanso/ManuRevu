// Client helper: ask the server to open the OS-native folder dialog
// (/api/folder-picker) and return the chosen absolute path, or null if the
// user cancelled / no picker is available on this platform.
export async function pickFolder(): Promise<string | null> {
  try {
    const res = await fetch('/api/folder-picker', { method: 'POST' })
    const data = await res.json() as { path?: string; error?: string }
    return data.path ?? null
  } catch {
    return null
  }
}
