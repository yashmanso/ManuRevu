import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import os from 'os'

export async function POST() {
  const platform = os.platform()
  try {
    let folderPath: string | null = null

    if (platform === 'darwin') {
      // macOS: AppleScript folder picker
      const result = execSync(
        `osascript -e 'POSIX path of (choose folder with prompt "Select folder for Reference Vault")'`,
        { timeout: 30000 }
      ).toString().trim()
      folderPath = result.endsWith('/') ? result.slice(0, -1) : result
    } else if (platform === 'linux') {
      // Linux: try zenity, fall back to kdialog
      try {
        folderPath = execSync('zenity --file-selection --directory --title="Select folder"', { timeout: 30000 })
          .toString().trim()
      } catch {
        folderPath = execSync('kdialog --getexistingdirectory "$HOME"', { timeout: 30000 })
          .toString().trim()
      }
    } else if (platform === 'win32') {
      // Windows: PowerShell folder browser dialog
      const ps = `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.ShowDialog() | Out-Null; $f.SelectedPath`
      folderPath = execSync(`powershell -command "${ps}"`, { timeout: 30000 }).toString().trim()
    }

    if (!folderPath) return NextResponse.json({ error: 'No folder selected' }, { status: 400 })
    return NextResponse.json({ path: folderPath })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    // User cancelled — not an error
    if (msg.includes('User canceled') || msg.includes('user cancelled') || msg.includes('cancel')) {
      return NextResponse.json({ error: 'cancelled' }, { status: 400 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
