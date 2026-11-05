import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { chmod, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const asar = require('@electron/asar');
const { inject } = require('postject');

const sentinelFuse = 'POSTJECT_SENTINEL_fce680ab2cc467b6e072b8b5df1996b2';
const fixSentinelFuse = 'pOSTJECT_SENTINEL_fce680ab2cc467b6e072b8b5df1996b2';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseDir = path.join(root, 'release');
const cacheDir = path.join(releaseDir, 'cache');
const stageDir = path.join(releaseDir, 'stage');
const bundleDir = path.join(releaseDir, 'Principe-Computers-Mac-and-Windows');
const zipName = 'Principe-Computers-Mac-and-Windows.zip';
const neuVersion = '6.10.0';
const neuZip = path.join(cacheDir, `neutralinojs-v${neuVersion}.zip`);
const neuDir = path.join(cacheDir, `neutralinojs-v${neuVersion}`);
const clientJs = path.join(cacheDir, 'neutralino.js');

function run(command, args, cwd = root) {
  execFileSync(command, args, { cwd, stdio: 'inherit' });
}

async function download(url, destination) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed ${response.status}: ${url}`);
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

async function ensureNeutralino() {
  await mkdir(cacheDir, { recursive: true });
  if (!await exists(neuZip)) {
    await download(
      `https://github.com/neutralinojs/neutralinojs/releases/download/v${neuVersion}/neutralinojs-v${neuVersion}.zip`,
      neuZip,
    );
  }
  if (!await exists(path.join(neuDir, 'neutralino-win_x64.exe'))) {
    await rm(neuDir, { recursive: true, force: true });
    await mkdir(neuDir, { recursive: true });
    run('unzip', ['-q', '-o', neuZip, '-d', neuDir]);
  }
  if (!await exists(clientJs)) {
    await download(
      `https://github.com/neutralinojs/neutralino.js/releases/download/v${neuVersion}/neutralino.js`,
      clientJs,
    );
  }
}

async function exists(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

async function makeIcons() {
  const buildDir = path.join(root, 'build');
  await mkdir(buildDir, { recursive: true });
  const svg = path.join(root, 'public', 'favicon.svg');
  const png512 = path.join(buildDir, 'icon-512.png');
  const png256 = path.join(buildDir, 'icon-256.png');
  const png128 = path.join(buildDir, 'icon-128.png');
  const png32 = path.join(buildDir, 'icon-32.png');
  const png16 = path.join(buildDir, 'icon-16.png');
  run('rsvg-convert', ['-w', '512', '-h', '512', svg, '-o', png512]);
  run('convert', [png512, '-resize', '256x256', png256]);
  run('convert', [png512, '-resize', '128x128', png128]);
  run('convert', [png512, '-resize', '32x32', png32]);
  run('convert', [png512, '-resize', '16x16', png16]);
  const ico = path.join(buildDir, 'icon.ico');
  const icns = path.join(buildDir, 'icon.icns');
  run('convert', [png16, png32, png128, png256, ico]);
  run('png2icns', [icns, png512, png256, png128, png32, png16]);
  return { png256, ico, icns };
}

function patchMachoSentinel(binary, beforeInjection) {
  const buffer = Buffer.from(binary);
  const first = buffer.indexOf(beforeInjection ? sentinelFuse : fixSentinelFuse);
  const last = buffer.lastIndexOf(sentinelFuse);
  if (beforeInjection) {
    if (first === -1 || last === -1 || first === last) {
      throw new Error('The Mac binary is missing the resource sentinel.');
    }
    buffer[first] = fixSentinelFuse.charCodeAt(0);
    return buffer;
  }
  buffer[first] = sentinelFuse.charCodeAt(0);
  const colonIndex = first + fixSentinelFuse.length;
  if (buffer[colonIndex] !== ':'.charCodeAt(0)) {
    throw new Error('The Mac binary sentinel was not patched.');
  }
  const flag = buffer[colonIndex + 1];
  if (flag !== '0'.charCodeAt(0) && flag !== '1'.charCodeAt(0)) {
    throw new Error('The Mac binary resource flag is missing.');
  }
  buffer[colonIndex + 1] = '1'.charCodeAt(0);
  return buffer;
}

async function embedResources(binaryPath, resourceBytes, universalMac) {
  if (universalMac) {
    const patched = patchMachoSentinel(await readFile(binaryPath), true);
    await writeFile(binaryPath, patched);
  }
  await inject(binaryPath, 'NEUTRALINOJS_RESOURCES_NEU', resourceBytes, {
    overwrite: true,
    sentinelFuse,
  });
  if (universalMac) {
    const patched = patchMachoSentinel(await readFile(binaryPath), false);
    await writeFile(binaryPath, patched);
  }
}

async function makeResources(icons) {
  const resourceRoot = path.join(stageDir, 'resources-src');
  const resourceDir = path.join(resourceRoot, 'resources');
  await rm(resourceRoot, { recursive: true, force: true });
  await mkdir(resourceDir, { recursive: true });
  await cp(path.join(root, 'dist'), resourceDir, { recursive: true });
  await cp(clientJs, path.join(resourceDir, 'neutralino.js'));
  await cp(icons.png256, path.join(resourceDir, 'icon.png'));
  await cp(path.join(root, 'desktop', 'neutralino.config.json'), path.join(resourceRoot, 'neutralino.config.json'));

  const indexPath = path.join(resourceDir, 'index.html');
  const html = await readFile(indexPath, 'utf8');
  const snippet = '    <script src="./neutralino.js"></script>\n    <script>Neutralino.init();</script>\n';
  if (!html.includes('neutralino.js')) {
    if (!html.includes('</head>')) throw new Error('Built index.html has no head tag');
    await writeFile(indexPath, html.replace('</head>', `${snippet}  </head>`));
  }

  const archive = path.join(stageDir, 'resources.neu');
  await asar.createPackage(resourceRoot, archive);
  return archive;
}

function installerScript(sourceDir, outFile, icon) {
  return `Unicode True
!include "MUI2.nsh"

Name "Principe Computers"
OutFile "${outFile}"
InstallDir "$LOCALAPPDATA\\Principe Computers"
RequestExecutionLevel user
SetCompressor /SOLID lzma

!define MUI_ICON "${icon}"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Install Principe Computers"
!define MUI_WELCOMEPAGE_TEXT "This installs the bench on this Windows PC. Your builds stay on this computer. Administrator rights are not required."
!define MUI_FINISHPAGE_RUN "$INSTDIR\\PrincipeComputers.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Open Principe Computers"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section "Install"
  SetOutPath "$INSTDIR"
  File "${sourceDir}/PrincipeComputers.exe"
  File "${sourceDir}/icon.ico"
  WriteUninstaller "$INSTDIR\\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\\Principe Computers"
  CreateShortcut "$SMPROGRAMS\\Principe Computers\\Principe Computers.lnk" "$INSTDIR\\PrincipeComputers.exe" "" "$INSTDIR\\icon.ico"
  CreateShortcut "$SMPROGRAMS\\Principe Computers\\Uninstall.lnk" "$INSTDIR\\Uninstall.exe"
  CreateShortcut "$DESKTOP\\Principe Computers.lnk" "$INSTDIR\\PrincipeComputers.exe" "" "$INSTDIR\\icon.ico"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PrincipeComputers" "DisplayName" "Principe Computers"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PrincipeComputers" "UninstallString" "$\\"$INSTDIR\\Uninstall.exe$\\""
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PrincipeComputers" "DisplayIcon" "$INSTDIR\\icon.ico"
  WriteRegDWORD HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PrincipeComputers" "NoModify" 1
  WriteRegDWORD HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PrincipeComputers" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\\Principe Computers.lnk"
  RMDir /r "$SMPROGRAMS\\Principe Computers"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PrincipeComputers"
SectionEnd
`;
}

const macPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>Principe Computers</string>
  <key>CFBundleDisplayName</key>
  <string>Principe Computers</string>
  <key>CFBundleIdentifier</key>
  <string>computers.principe.bench</string>
  <key>CFBundleVersion</key>
  <string>0.1.0</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>CFBundleExecutable</key>
  <string>PrincipeComputers</string>
  <key>CFBundleIconFile</key>
  <string>icon</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>LSMinimumSystemVersion</key>
  <string>11.0</string>
</dict>
</plist>
`;

const installText = `Principe Computers

This folder has the Windows installer and the Mac app.

Windows
1. Double-click Principe-Computers-Windows-Setup.exe.
2. If Windows shows SmartScreen, choose More info, then Run anyway. This copy is not signed with a paid Windows certificate.
3. The installer adds a desktop shortcut and a Start menu entry. It does not need administrator rights.
4. Your builds stay on this computer, under your AppData folder.

Mac (Apple Silicon and Intel)
1. Unzip Principe-Computers-macOS.zip.
2. Drag Principe Computers into Applications.
3. The first open is blocked because this copy is not signed with an Apple Developer ID.
   Right-click the app, choose Open, then choose Open again.
   If macOS still refuses, open Terminal and run:
   xattr -dr com.apple.quarantine "/Applications/Principe Computers.app"
4. Your builds stay on this computer.
`;

async function main() {
  await ensureNeutralino();
  const icons = await makeIcons();
  const resources = await makeResources(icons);

  const resourceBytes = await readFile(resources);

  const winDir = path.join(stageDir, 'windows');
  await rm(winDir, { recursive: true, force: true });
  await mkdir(winDir, { recursive: true });
  const winExe = path.join(winDir, 'PrincipeComputers.exe');
  await cp(path.join(neuDir, 'neutralino-win_x64.exe'), winExe);
  await embedResources(winExe, resourceBytes, false);
  await cp(icons.ico, path.join(winDir, 'icon.ico'));

  const linuxDir = path.join(stageDir, 'linux');
  await rm(linuxDir, { recursive: true, force: true });
  await mkdir(linuxDir, { recursive: true });
  const linuxBin = path.join(linuxDir, 'PrincipeComputers');
  await cp(path.join(neuDir, 'neutralino-linux_x64'), linuxBin);
  await chmod(linuxBin, 0o755);
  await embedResources(linuxBin, resourceBytes, false);

  const appDir = path.join(stageDir, 'mac', 'Principe Computers.app');
  const macOs = path.join(appDir, 'Contents', 'MacOS');
  const macRes = path.join(appDir, 'Contents', 'Resources');
  await rm(path.join(stageDir, 'mac'), { recursive: true, force: true });
  await mkdir(macOs, { recursive: true });
  await mkdir(macRes, { recursive: true });
  const macBin = path.join(macOs, 'PrincipeComputers');
  await cp(path.join(neuDir, 'neutralino-mac_universal'), macBin);
  await chmod(macBin, 0o755);
  await embedResources(macBin, resourceBytes, true);
  await cp(icons.icns, path.join(macRes, 'icon.icns'));
  await writeFile(path.join(appDir, 'Contents', 'Info.plist'), macPlist);
  await writeFile(path.join(appDir, 'Contents', 'PkgInfo'), 'APPL????');

  await rm(bundleDir, { recursive: true, force: true });
  await mkdir(bundleDir, { recursive: true });
  const setupExe = path.join(bundleDir, 'Principe-Computers-Windows-Setup.exe');
  const nsiPath = path.join(releaseDir, 'installer.nsi');
  await writeFile(nsiPath, installerScript(winDir, setupExe, icons.ico));
  run('makensis', [nsiPath]);

  const macZip = path.join(bundleDir, 'Principe-Computers-macOS.zip');
  await writeFile(path.join(stageDir, 'mac', 'Install on Mac.txt'), 'Drag Principe Computers into Applications, then right-click it and choose Open the first time.\n');
  run('zip', ['-r', '-y', '-q', macZip, 'Principe Computers.app', 'Install on Mac.txt'], path.join(stageDir, 'mac'));
  await writeFile(path.join(bundleDir, 'INSTALL.txt'), installText);

  const zipPath = path.join(releaseDir, zipName);
  await rm(zipPath, { force: true });
  run('zip', ['-r', '-y', '-q', zipPath, path.basename(bundleDir)], releaseDir);
  console.log(`Wrote ${zipPath}`);
}

await main();
