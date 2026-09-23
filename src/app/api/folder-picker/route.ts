import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import os from 'os'

// Opens the OS-native folder dialog on the machine running the server and
// returns the chosen absolute path. Browsers can't provide real filesystem
// paths (showDirectoryPicker only exposes the folder *name*), so for this
// local single-user app the server owns the dialog.

function pickFolderNative(): string | null {
  switch (os.platform()) {
    case 'darwin': {
      const out = execSync(
        `osascript -e 'POSIX path of (choose folder with prompt "Select folder for Reference Vault")'`,
        { timeout: 60000 }
      ).toString().trim()
      return out.replace(/\/$/, '')
    }
    case 'linux': {
      try {
        return execSync('zenity --file-selection --directory --title="Select folder"', { timeout: 60000 }).toString().trim()
      } catch (err) {
        // zenity exits 1 on user cancel; only fall through to kdialog when
        // zenity isn't installed at all
        if (err && typeof err === 'object' && 'status' in err && err.status === 1) return null
        return execSync('kdialog --getexistingdirectory "$HOME"', { timeout: 60000 }).toString().trim()
      }
    }
    case 'win32': {
      const ps = 'Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.ShowDialog() | Out-Null; $f.SelectedPath'
      return execSync(`powershell -command "${ps}"`, { timeout: 60000 }).toString().trim()
    }
    default:
      throw new Error(`No folder dialog available on platform "${os.platform()}" — enter the path manually.`)
  }
}

export async function POST() {
  try {
    const folderPath = pickFolderNative()
    if (!folderPath) return NextResponse.json({ error: 'cancelled' }, { status: 400 })
    return NextResponse.json({ path: folderPath })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/cancel/i.test(msg)) {
      return NextResponse.json({ error: 'cancelled' }, { status: 400 })
    }
    if (/not found|ENOENT/i.test(msg)) {
      return NextResponse.json(
        { error: 'No graphical folder picker found (install zenity or kdialog) — enter the path manually.' },
        { status: 501 }
      )
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
