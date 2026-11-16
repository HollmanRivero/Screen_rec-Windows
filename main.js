const { app, BrowserWindow, ipcMain, desktopCapturer, dialog, systemPreferences, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { execFile } = require('child_process')
const licenseManager = require('./license-manager')
const paypalService = require('./paypal-service')

let mainWindow = null
let selectedSourceId = null
let cachedSources = []

// Resolves FFmpeg binary with resilient multi-location fallback paths
function getFFmpegPath() {
  const candidates = []

  // 1. ffmpeg-static module resolution
  try {
    let p = require('ffmpeg-static')
    if (p) {
      candidates.push(p)
      if (app && app.isPackaged) {
        candidates.push(p.replace('app.asar', 'app.asar.unpacked'))
      }
    }
  } catch (e) {}

  // 2. Packaged electron app resources directory
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'))
    candidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', 'ffmpeg'))
    candidates.push(path.join(process.resourcesPath, 'ffmpeg.exe'))
    candidates.push(path.join(process.resourcesPath, 'ffmpeg'))
    candidates.push(path.join(process.resourcesPath, 'bin', 'ffmpeg.exe'))
    candidates.push(path.join(process.resourcesPath, 'bin', 'ffmpeg'))
  }

  // 3. Executable directory (where ScreenRec.exe lives)
  if (process.execPath) {
    const execDir = path.dirname(process.execPath)
    candidates.push(path.join(execDir, 'resources', 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'))
    candidates.push(path.join(execDir, 'resources', 'ffmpeg.exe'))
    candidates.push(path.join(execDir, 'ffmpeg.exe'))
  }

  // 4. Local workspace / appPath node_modules
  try {
    const appDir = (app && app.getAppPath) ? app.getAppPath() : __dirname
    candidates.push(path.join(appDir, 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'))
    candidates.push(path.join(__dirname, 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'))
  } catch (e) {}

  // 5. Installed location in %LOCALAPPDATA%
  if (process.env.LOCALAPPDATA) {
    candidates.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'ScreenRec', 'resources', 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'))
    candidates.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'ScreenRec', 'resources', 'ffmpeg.exe'))
    candidates.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'ScreenRec', 'ffmpeg.exe'))
  }

  // 6. Unix & System fallbacks
  candidates.push('/usr/local/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg', '/usr/bin/ffmpeg', 'ffmpeg')

  for (const c of candidates) {
    if (!c || c === 'ffmpeg') continue
    if (fs.existsSync(c)) {
      try {
        const stat = fs.statSync(c)
        if (stat.isFile() && stat.size > 100000) {
          return c
        }
      } catch {}
    }
  }

  return 'ffmpeg'
}

// Fetch all screen and window sources
async function getSourcesList() {
  try {
    cachedSources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: false
    })
  } catch (err) {
    try {
      cachedSources = await desktopCapturer.getSources({ types: ['screen'] })
    } catch {
      cachedSources = []
    }
  }
  return cachedSources
}

async function createWindow() {
  // Pre-load sources BEFORE window creation so cache is immediately ready
  await getSourcesList()

  mainWindow = new BrowserWindow({
    width: 960,
    height: 680,
    frame: false,
    transparent: false,
    resizable: true,
    minWidth: 850,
    minHeight: 580,
    backgroundColor: '#0f0f1a',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  })

  const ses = mainWindow.webContents.session
  if (ses.setPermissionRequestHandler) ses.setPermissionRequestHandler((w, p, cb) => cb(true))
  if (ses.setPermissionCheckHandler) ses.setPermissionCheckHandler(() => true)

  // Direct DisplayMedia request handler
  if (ses.setDisplayMediaRequestHandler) {
    ses.setDisplayMediaRequestHandler(async (request, callback) => {
      try {
        let sources = cachedSources
        if (!sources || sources.length === 0) {
          sources = await getSourcesList()
        }

        const source = (selectedSourceId ? sources.find(s => s.id === selectedSourceId) : null)
          || sources.find(s => s.id.startsWith('screen:'))
          || sources[0]

        if (!source) {
          console.error('setDisplayMediaRequestHandler: no source available')
          return callback({})
        }
        const streamConfig = { video: source }
        if (request && request.audioRequested) {
          streamConfig.audio = 'loopback'
        }
        callback(streamConfig)
      } catch (err) {
        console.error('setDisplayMediaRequestHandler error:', err)
        callback({})
      }
    }, { useSystemPicker: false })
  }

  mainWindow.loadFile('index.html')

  // Keyboard shortcut to toggle DevTools (Cmd+Option+I / F12)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (((input.control || input.meta) && input.alt && input.key.toLowerCase() === 'i') || input.key === 'F12') {
      mainWindow.webContents.toggleDevTools()
    }
  })

  if (process.platform === 'darwin' && systemPreferences.askForMediaAccess) {
    systemPreferences.askForMediaAccess('camera').catch(() => {})
    systemPreferences.askForMediaAccess('microphone').catch(() => {})
  }
}

// ── CLI Command-Line Support ──
async function handleCliCommands() {
  const args = process.argv.slice(1)
  const isHelp = args.some(a => a === '--help' || a === '-h' || a === '/?')
  const isCheck = args.some(a => a === '--check-audio' || a === '--check')
  const testIdx = args.findIndex(a => a === '--test-record' || a === '--cli-record')
  const hasTest = testIdx !== -1

  if (!isHelp && !isCheck && !hasTest) {
    return false // Standard GUI launch
  }

  const ffmpeg = getFFmpegPath()

  if (isHelp) {
    console.log(`
========================================
ScreenRec CLI - Hjelp og Opsjoner
========================================
Bruk:
  ScreenRec.exe [opsjoner]

Opsjoner:
  --test-record [sekunder]   Ta opp skjerm og lyd i N sekunder (standard: 3s) og verifiser
  --out <filsti>             Valgfri sti for lagring av opptaket (standard: %TEMP%\\screenrec-cli-test.mp4)
  --play                     Spill av / åpne opptaket automatisk etter lagring
  --check-audio              Sjekk FFmpeg og tilgjengelige skjerm/lyd-kilder
  --help, -h                 Vis denne hjelpeteksten
========================================
`)
    app.quit()
    return true
  }

  if (isCheck) {
    console.log('\n--- ScreenRec Audio & Miljø Sjekk ---')
    console.log('Plattform:', process.platform, process.arch)
    console.log('Node.js:', process.version)
    console.log('FFmpeg sti:', ffmpeg)
    console.log('FFmpeg finnes:', fs.existsSync(ffmpeg))
    if (fs.existsSync(ffmpeg)) {
      try {
        const stats = fs.statSync(ffmpeg)
        console.log('FFmpeg filstørrelse:', (stats.size / 1024 / 1024).toFixed(1), 'MB')
      } catch {}
    }
    const sources = await getSourcesList()
    console.log(`Funnet ${sources.length} opptakskilde(r):`)
    sources.forEach(s => console.log(`  - [${s.id}] ${s.name}`))
    console.log('--- Sjekk fullført! Alt er klart for opptak med lyd. ---\n')
    app.quit()
    return true
  }

  if (hasTest) {
    let duration = 3
    const nextArg = args[testIdx + 1]
    if (nextArg && !nextArg.startsWith('-') && !isNaN(parseInt(nextArg, 10))) {
      duration = Math.max(1, parseInt(nextArg, 10))
    }

    let outPath = null
    const outIdx = args.indexOf('--out')
    if (outIdx !== -1 && args[outIdx + 1]) {
      outPath = path.resolve(args[outIdx + 1])
    } else {
      outPath = path.join(os.tmpdir(), `screenrec-cli-test-${Date.now()}.mp4`)
    }

    const shouldPlay = args.includes('--play')

    console.log(`\n--- Starter ScreenRec CLI Testopptak (${duration} sekunder) ---`)
    console.log('Målfil:', outPath)
    console.log('FFmpeg:', ffmpeg)

    await runCliRecording({ duration, outPath, ffmpeg, shouldPlay })
    return true
  }

  return false
}

// Executes an automated recording and verifies the output audio track
async function runCliRecording({ duration, outPath, ffmpeg, shouldPlay }) {
  await getSourcesList()

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  win.webContents.session.setPermissionRequestHandler((w, p, cb) => cb(true))
  win.webContents.session.setPermissionCheckHandler(() => true)
  win.webContents.session.setDisplayMediaRequestHandler(async (req, cb) => {
    const sources = cachedSources.length > 0 ? cachedSources : await getSourcesList()
    cb({ video: sources[0], audio: 'loopback' })
  })

  await win.loadFile('index.html')

  console.log(`Venter på at opptaksstrøm og kilde er klar...`)
  const escapedOutPath = JSON.stringify(outPath)
  const recordResult = await win.webContents.executeJavaScript(`
    (async () => {
      try {
        window.__cliTargetPath = ${escapedOutPath};
        for (let i = 0; i < 50; i++) {
          if (screenStream && screenStream.active && selectedSource) break;
          await new Promise(r => setTimeout(r, 200));
        }

        toggleDesktopAudio.checked = true;
        toggleMic.checked = true;
        await startRecording();
        const recActive = isRecording;

        await new Promise(r => setTimeout(r, ${duration * 1000}));

        stopRecording();

        for (let i = 0; i < 70; i++) {
          const s = document.getElementById('status')?.textContent;
          if (s && (s.includes('Opptak lagret') || s.includes('Lagringsfeil'))) {
            return { status: s, isRecording: recActive };
          }
          await new Promise(r => setTimeout(r, 200));
        }
        return { status: document.getElementById('status')?.textContent, isRecording: recActive };
      } catch (e) {
        return { error: e.message };
      }
    })()
  `)

  console.log('Opptaksstatus fra renderer:', recordResult)

  // Probe output file using ffmpeg to verify audio stream
  if (fs.existsSync(outPath)) {
    const size = fs.statSync(outPath).size
    console.log(`\n✅ Opptaksfil lagret suksessfullt: ${outPath} (${(size / 1024).toFixed(1)} KB)`)
    execFile(ffmpeg, ['-i', outPath], (_err, pOut, pErr) => {
      const probeInfo = (pErr || '') + (pOut || '')
      const hasAudio = probeInfo.includes('Audio:') || probeInfo.includes('Stream #0:1')
      const hasVideo = probeInfo.includes('Video:') || probeInfo.includes('Stream #0:0')
      console.log('--- Strømanalyse av opptak ---')
      console.log(`  Videostrøm: ${hasVideo ? 'Ja (H.264 video registrert ✓)' : 'Ingen'}`)
      console.log(`  Lydstrøm:   ${hasAudio ? 'Ja (AAC / Loopback lyd registrert ✓)' : 'Ingen'}`)
      if (hasAudio) {
        console.log('🎉 RESULTAT: Både bilde OG lyd ble tatt opp og lagret perfekt!')
      } else {
        console.log('ℹ️ Resultat: Video lagret (lydspor var tomt eller ikke aktivt).')
      }

      if (shouldPlay) {
        console.log('Åpner opptaksfil...')
        shell.openPath(outPath)
      }
      setTimeout(() => app.quit(), 500)
    })
  } else {
    console.error('❌ Målfilen ble ikke funnet etter opptak:', outPath)
    app.quit()
  }
}

app.whenReady().then(async () => {
  const handled = await handleCliCommands()
  if (!handled) {
    createWindow()
  }
})

app.on('window-all-closed', () => app.quit())

// ── IPC Handlers ──
ipcMain.handle('get-sources', async () => {
  const sources = await getSourcesList()
  return sources.map(s => ({
    id: s.id,
    name: s.name || (s.id.startsWith('screen:') ? 'Skjerm ' + s.id : 'Vindu'),
    type: s.id.startsWith('screen:') ? 'screen' : 'window',
    thumbnail: s.thumbnail ? s.thumbnail.toDataURL() : ''
  }))
})

ipcMain.handle('set-source-id', (_, id) => {
  selectedSourceId = id
  return true
})

ipcMain.handle('check-permissions', async () => {
  if (process.platform !== 'darwin') return { screen: 'granted', camera: 'granted', mic: 'granted' }
  try {
    return {
      screen: systemPreferences.getMediaAccessStatus ? systemPreferences.getMediaAccessStatus('screen') : 'granted',
      camera: systemPreferences.getMediaAccessStatus ? systemPreferences.getMediaAccessStatus('camera') : 'granted',
      mic: systemPreferences.getMediaAccessStatus ? systemPreferences.getMediaAccessStatus('microphone') : 'granted'
    }
  } catch {
    return { screen: 'granted', camera: 'granted', mic: 'granted' }
  }
})

ipcMain.handle('request-media-access', async (_, mediaType) => {
  if (process.platform === 'darwin' && systemPreferences.askForMediaAccess) {
    try { return await systemPreferences.askForMediaAccess(mediaType) } catch { return false }
  }
  return true
})

ipcMain.handle('open-system-settings', async (_, type) => {
  if (process.platform === 'darwin') {
    if (type === 'screen') shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
    else if (type === 'camera') shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Camera')
    else if (type === 'microphone') shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone')
  }
})

ipcMain.handle('open-file-location', async (_, filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath)
    return true
  }
  return false
})

ipcMain.handle('open-file', async (_, filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    shell.openPath(filePath)
    return true
  }
  return false
})

// ── Commercial License & Trial Handlers ──
ipcMain.handle('get-license-status', () => licenseManager.getStatus())
ipcMain.handle('activate-license-key', (_, key) => licenseManager.activate(key))
ipcMain.handle('tick-trial', (_, seconds) => licenseManager.tickTrial(seconds))
ipcMain.handle('open-payment-link', (_, provider) => licenseManager.openPayment(provider))

ipcMain.handle('start-paypal-checkout', async () => {
  try {
    const result = await paypalService.startCheckout(mainWindow)
    if (result.success) {
      const activation = licenseManager.generateAndActivateKey()
      return {
        success: true,
        licenseKey: activation.key,
        orderId: result.orderId,
        status: licenseManager.getStatus()
      }
    } else {
      return { success: false, canceled: result.canceled }
    }
  } catch (err) {
    console.error('[PayPal Checkout Error]:', err.message)
    return { success: false, error: err.message }
  }
})

// ── Recording Save & Conversion Handler ──
ipcMain.handle('save-recording', async (event, { buffer, format, targetPath }) => {
  const ext = (format || 'mp4').toLowerCase()
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const tmpWebm = path.join(os.tmpdir(), `screenrec-src-${ts}.webm`)
  const defaultName = `screenrec-${ts}.${ext}`

  try {
    fs.writeFileSync(tmpWebm, Buffer.from(buffer))
  } catch (err) {
    return { success: false, error: 'Kunne ikke opprette kilde-buffer: ' + err.message }
  }

  let filePath = targetPath

  if (!filePath) {
    const filterMap = {
      mp4:  { name: 'MP4 Video (*.mp4)', extensions: ['mp4'] },
      webm: { name: 'WebM Video (*.webm)', extensions: ['webm'] },
      mov:  { name: 'MOV QuickTime (*.mov)', extensions: ['mov'] },
      avi:  { name: 'AVI Video (*.avi)', extensions: ['avi'] },
      webp: { name: 'Animated WebP (*.webp)', extensions: ['webp'] }
    }
    const primary = filterMap[ext] || filterMap.mp4
    const others  = Object.values(filterMap).filter(f => f.extensions[0] !== primary.extensions[0])

    const saveRes = await dialog.showSaveDialog(mainWindow, {
      title: 'Lagre opptak',
      defaultPath: path.join(app.getPath('videos') || os.tmpdir(), defaultName),
      filters: [primary, ...others]
    })

    if (saveRes.canceled || !saveRes.filePath) {
      try { fs.unlinkSync(tmpWebm) } catch {}
      return { success: false, canceled: true }
    }
    filePath = saveRes.filePath
  }

  const chosenExt = (path.extname(filePath).slice(1) || ext).toLowerCase()

  // WebM format needs no conversion
  if (chosenExt === 'webm') {
    try {
      fs.copyFileSync(tmpWebm, filePath)
      try { fs.unlinkSync(tmpWebm) } catch {}
      return { success: true, filePath }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  const ffmpegBinary = getFFmpegPath()
  const tmpOut = path.join(os.tmpdir(), `screenrec-out-${ts}.${chosenExt}`)
  const isMac = process.platform === 'darwin'
  const useVideoToolbox = isMac && (chosenExt === 'mp4' || chosenExt === 'mov')

  const ffmpegArgs = ['-i', tmpWebm]

  if (chosenExt === 'webp') {
    ffmpegArgs.push('-an', '-c:v', 'libwebp', '-quality', '80', '-loop', '0')
  } else {
    if (useVideoToolbox) {
      ffmpegArgs.push(
        '-c:v', 'h264_videotoolbox',
        '-b:v', '6000k',
        '-pix_fmt', 'yuv420p'
      )
    } else {
      ffmpegArgs.push(
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-pix_fmt', 'yuv420p'
      )
    }

    ffmpegArgs.push(
      '-c:a', chosenExt === 'avi' ? 'libmp3lame' : 'aac',
      '-b:a', '192k'
    )

    if (chosenExt === 'mp4' || chosenExt === 'mov') {
      ffmpegArgs.push('-movflags', '+faststart')
    }
  }
  ffmpegArgs.push('-y', tmpOut)

  // Resilient fallback: If conversion fails, save raw WebM so user NEVER loses recording
  const fallbackSaveWebm = (reason) => {
    try {
      let fb = filePath
      if (!fb.toLowerCase().endsWith('.webm')) {
        fb = fb.replace(/\.[^.]+$/, '') + '.webm'
      }
      fs.copyFileSync(tmpWebm, fb)
      try { fs.unlinkSync(tmpWebm) } catch {}
      try { fs.unlinkSync(tmpOut) } catch {}
      return {
        success: true,
        filePath: fb,
        fallbackNotice: `FFmpeg konvertering feilet (${reason}), men opptaket ble trygt lagret som WebM: ${path.basename(fb)}`
      }
    } catch (fbErr) {
      return { success: false, error: 'Kunne ikke lagre opptak: ' + fbErr.message }
    }
  }

  return new Promise((resolve) => {
    execFile(ffmpegBinary, ffmpegArgs, (err, _stdout, stderr) => {
      if (err) {
        if (useVideoToolbox) {
          console.warn('VideoToolbox encoder failed, retrying with libx264 software encoder:', stderr || err.message)
          const fallbackArgs = [
            '-i', tmpWebm,
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-pix_fmt', 'yuv420p',
            '-c:a', chosenExt === 'avi' ? 'libmp3lame' : 'aac',
            '-b:a', '192k',
            '-movflags', '+faststart',
            '-y', tmpOut
          ]
          execFile(ffmpegBinary, fallbackArgs, (fbErr, _fbStdout, fbStderr) => {
            if (fbErr) {
              resolve(fallbackSaveWebm(fbStderr || fbErr.message))
            } else {
              try {
                fs.copyFileSync(tmpOut, filePath)
                try { fs.unlinkSync(tmpOut) } catch {}
                try { fs.unlinkSync(tmpWebm) } catch {}
                resolve({ success: true, filePath })
              } catch (copyErr) {
                resolve(fallbackSaveWebm(copyErr.message))
              }
            }
          })
          return
        }

        console.warn('FFmpeg conversion error, saving as WebM fallback:', stderr || err.message)
        resolve(fallbackSaveWebm(stderr || err.message))
      } else {
        try {
          fs.copyFileSync(tmpOut, filePath)
          try { fs.unlinkSync(tmpOut) } catch {}
          try { fs.unlinkSync(tmpWebm) } catch {}
          resolve({ success: true, filePath })
        } catch (copyErr) {
          resolve(fallbackSaveWebm(copyErr.message))
        }
      }
    })
  })
})

ipcMain.on('minimize-window', () => mainWindow?.minimize())
ipcMain.on('close-window', () => mainWindow?.close())
