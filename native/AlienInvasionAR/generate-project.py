#!/usr/bin/env python3
"""Generate a dependency-free, isolated Xcode project. No Earnly app changes."""
from pathlib import Path
import hashlib, math, struct, wave, plistlib
root = Path(__file__).resolve().parent
def uid(s): return hashlib.sha1(s.encode()).hexdigest()[:24].upper()
objects = []
def obj(name, content):
    objects.append(f'{uid(name)} = {{ {content} }};')
    return uid(name)
files = ['Sources/App.swift','Sources/World.swift','Sources/GameViewController.swift','zap.wav']
for f in files:
    obj('ref'+f, f'isa = PBXFileReference; lastKnownFileType = {"sourcecode.swift" if f.endswith("swift") else "audio.wav"}; path = "{f}"; sourceTree = "<group>";')
    obj('build'+f, f'isa = PBXBuildFile; fileRef = {uid("ref"+f)};')
obj('app', 'isa = PBXFileReference; explicitFileType = wrapper.application; path = AlienInvasionAR.app; sourceTree = BUILT_PRODUCTS_DIR;')
obj('products', f'isa = PBXGroup; children = ({uid("app")}); name = Products; sourceTree = "<group>";')
obj('group', 'isa = PBXGroup; children = (' + ','.join([uid('ref'+f) for f in files]+[uid('products')]) + '); sourceTree = "<group>";')
obj('sources', 'isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ('+','.join(uid('build'+f) for f in files if f.endswith('swift'))+'); runOnlyForDeploymentPostprocessing = 0;')
obj('resources',f'isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = ({uid("buildzap.wav")}); runOnlyForDeploymentPostprocessing = 0;')
obj('frameworks','isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;')
common = 'IPHONEOS_DEPLOYMENT_TARGET = 17.0; SDKROOT = iphoneos; SWIFT_VERSION = 5.0; CLANG_ENABLE_MODULES = YES; '
target = common + 'PRODUCT_NAME = "$(TARGET_NAME)"; PRODUCT_BUNDLE_IDENTIFIER = com.earnlyarcade.alieninvasion.prototype; INFOPLIST_FILE = Info.plist; TARGETED_DEVICE_FAMILY = 1; CODE_SIGN_STYLE = Automatic; CURRENT_PROJECT_VERSION = 1; MARKETING_VERSION = 0.1; SWIFT_EMIT_LOC_STRINGS = NO; '
for scope,settings in [('project',common),('target',target)]:
    for mode in ['Debug','Release']:
        opt = 'SWIFT_OPTIMIZATION_LEVEL = "-Onone"; DEBUG_INFORMATION_FORMAT = dwarf; ' if mode=='Debug' else 'SWIFT_OPTIMIZATION_LEVEL = "-O"; DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym"; '
        obj(scope+mode,f'isa = XCBuildConfiguration; buildSettings = {{ {settings}{opt} }}; name = {mode};')
    obj(scope+'configs',f'isa = XCConfigurationList; buildConfigurations = ({uid(scope+"Debug")},{uid(scope+"Release")}); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;')
obj('target',f'isa = PBXNativeTarget; buildConfigurationList = {uid("targetconfigs")}; buildPhases = ({uid("sources")},{uid("frameworks")},{uid("resources")}); buildRules = (); dependencies = (); name = AlienInvasionAR; productName = AlienInvasionAR; productReference = {uid("app")}; productType = "com.apple.product-type.application";')
obj('project',f'isa = PBXProject; attributes = {{ LastUpgradeCheck = 1600; }}; buildConfigurationList = {uid("projectconfigs")}; compatibilityVersion = "Xcode 14.0"; developmentRegion = en; knownRegions = (en,Base); mainGroup = {uid("group")}; productRefGroup = {uid("products")}; projectDirPath = ""; projectRoot = ""; targets = ({uid("target")});')
project=root/'AlienInvasionAR.xcodeproj'; project.mkdir(exist_ok=True)
(project/'project.pbxproj').write_text('// !$*UTF8*$!\n{ archiveVersion = 1; classes = {}; objectVersion = 56; objects = {\n'+'\n'.join(objects)+f'\n}}; rootObject = {uid("project")}; }}\n')
schemes=project/'xcshareddata/xcschemes'; schemes.mkdir(parents=True,exist_ok=True)
ref=f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{uid("target")}" BuildableName="AlienInvasionAR.app" BlueprintName="AlienInvasionAR" ReferencedContainer="container:AlienInvasionAR.xcodeproj"/>'
(schemes/'AlienInvasionAR.xcscheme').write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1600" version="1.3"><BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{ref}</BuildActionEntry></BuildActionEntries></BuildAction><LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{ref}</BuildableProductRunnable></LaunchAction><ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">{ref}</BuildableProductRunnable></ProfileAction><AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/></Scheme>''')
info={'CFBundleDisplayName':'Alien Invasion AR','CFBundleIdentifier':'$(PRODUCT_BUNDLE_IDENTIFIER)','CFBundleExecutable':'$(EXECUTABLE_NAME)','CFBundleName':'$(PRODUCT_NAME)','CFBundlePackageType':'APPL','CFBundleShortVersionString':'0.1','CFBundleVersion':'1','LSRequiresIPhoneOS':True,'NSCameraUsageDescription':'Show your room and track alien portals in 3D. Camera footage stays on your device.','UIRequiredDeviceCapabilities':['arkit','arm64'],'UISupportedInterfaceOrientations':['UIInterfaceOrientationPortrait'],'UILaunchScreen':{},'ITSAppUsesNonExemptEncryption':False}
(root/'Info.plist').write_bytes(plistlib.dumps(info))
with wave.open(str(root/'zap.wav'),'wb') as audio:
    audio.setparams((1,2,22050,0,'NONE','not compressed'))
    audio.writeframes(b''.join(struct.pack('<h',int(8000*(1-i/4400)**2*math.sin(2*math.pi*(900*i/22050-550*(i/22050)**2)))) for i in range(4400)))
print('Generated AlienInvasionAR.xcodeproj, Info.plist and positional sound.')
