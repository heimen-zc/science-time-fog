from pathlib import Path
import hashlib, json
root=Path(__file__).resolve().parents[1]/'TimeFog'
project=root/'TimeFog.xcodeproj';project.mkdir(exist_ok=True)
objects={}
def uid(key):return hashlib.sha1(key.encode()).hexdigest()[:24].upper()
def q(s):return json.dumps(str(s),ensure_ascii=False)
def obj(key,isa,body):
 i=uid(key);objects[i]='{isa = '+isa+'; '+body+' };';return i
def array(values):return '('+','.join(values)+',)'
source_refs=[];source_build=[]
for p in sorted((root/'Sources').glob('*.swift')):
 ref=obj('source:'+p.name,'PBXFileReference','lastKnownFileType = sourcecode.swift; path = '+q(p.name)+'; sourceTree = "<group>";')
 source_refs.append(ref);source_build.append(obj('build:'+p.name,'PBXBuildFile','fileRef = '+ref+';'))
test_refs=[];test_build=[]
for p in sorted((root/'UITests').glob('*.swift')):
 ref=obj('test:'+p.name,'PBXFileReference','lastKnownFileType = sourcecode.swift; path = '+q(p.name)+'; sourceTree = "<group>";')
 test_refs.append(ref);test_build.append(obj('testbuild:'+p.name,'PBXBuildFile','fileRef = '+ref+';'))
sources=obj('sources','PBXGroup','children = '+array(source_refs)+'; path = Sources; sourceTree = "<group>";')
tests=obj('tests','PBXGroup','children = '+array(test_refs)+'; path = UITests; sourceTree = "<group>";')
resources=obj('resources','PBXFileReference','lastKnownFileType = folder; path = Content; sourceTree = "<group>";')
assets=obj('assets','PBXFileReference','lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = "<group>";')
resource_build=[obj('resources-build','PBXBuildFile','fileRef = '+resources+';'),obj('assets-build','PBXBuildFile','fileRef = '+assets+';')]
app_product=obj('app-product','PBXFileReference','explicitFileType = wrapper.application; path = TimeFog.app; sourceTree = BUILT_PRODUCTS_DIR;')
test_product=obj('test-product','PBXFileReference','explicitFileType = wrapper.cfbundle; path = TimeFogUITests.xctest; sourceTree = BUILT_PRODUCTS_DIR;')
products=obj('products','PBXGroup','children = '+array([app_product,test_product])+'; name = Products; sourceTree = "<group>";')
main=obj('main','PBXGroup','children = '+array([sources,resources,assets,tests,products])+'; sourceTree = "<group>";')
package=obj('core-package','XCLocalSwiftPackageReference','relativePath = ../TimeFogCore;')
core=obj('core-product','XCSwiftPackageProductDependency','package = '+package+'; productName = TimeFogCore;')
core_build=obj('core-build','PBXBuildFile','productRef = '+core+';')
app_sources=obj('app-sources','PBXSourcesBuildPhase','buildActionMask = 2147483647; files = '+array(source_build)+'; runOnlyForDeploymentPostprocessing = 0;')
app_resources=obj('app-resources','PBXResourcesBuildPhase','buildActionMask = 2147483647; files = '+array(resource_build)+'; runOnlyForDeploymentPostprocessing = 0;')
app_frameworks=obj('app-frameworks','PBXFrameworksBuildPhase','buildActionMask = 2147483647; files = '+array([core_build])+'; runOnlyForDeploymentPostprocessing = 0;')
test_sources=obj('test-sources','PBXSourcesBuildPhase','buildActionMask = 2147483647; files = '+array(test_build)+'; runOnlyForDeploymentPostprocessing = 0;')
test_frameworks=obj('test-frameworks','PBXFrameworksBuildPhase','buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;')
def settings(values):return '{'+' '.join(k+' = '+q(v)+';' for k,v in values.items())+'}'
def configurations(key,base):
 ids=[]
 for name in ['Debug','Release']:
  s=dict(base);s.update({'SWIFT_OPTIMIZATION_LEVEL':'-Onone' if name=='Debug' else '-O','DEBUG_INFORMATION_FORMAT':'dwarf' if name=='Debug' else 'dwarf-with-dsym'})
  if name=='Debug':s['SWIFT_ACTIVE_COMPILATION_CONDITIONS']='DEBUG';s['ONLY_ACTIVE_ARCH']='YES'
  ids.append(obj(key+name,'XCBuildConfiguration','buildSettings = '+settings(s)+'; name = '+name+';'))
 return obj(key+'config','XCConfigurationList','buildConfigurations = '+array(ids)+'; defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;')
base={'IPHONEOS_DEPLOYMENT_TARGET':'17.0','SWIFT_VERSION':'5.0','CLANG_ENABLE_MODULES':'YES','SWIFT_STRICT_CONCURRENCY':'targeted','SDKROOT':'iphoneos','TARGETED_DEVICE_FAMILY':'1','SUPPORTED_PLATFORMS':'iphoneos iphonesimulator'}
project_config=configurations('project',base)
app_settings={'PRODUCT_NAME':'$(TARGET_NAME)','PRODUCT_BUNDLE_IDENTIFIER':'org.heimenzc.timefog','GENERATE_INFOPLIST_FILE':'YES','INFOPLIST_KEY_CFBundleDisplayName':'时间迷雾','INFOPLIST_KEY_NSFaceIDUsageDescription':'家长查看外部史料或清除进展前，使用系统验证设备解锁权限。','INFOPLIST_KEY_UIApplicationSceneManifest_Generation':'YES','INFOPLIST_KEY_UILaunchScreen_Generation':'YES','INFOPLIST_KEY_UISupportedInterfaceOrientations':'UIInterfaceOrientationPortrait','ASSETCATALOG_COMPILER_APPICON_NAME':'AppIcon','CODE_SIGN_STYLE':'Automatic','MARKETING_VERSION':'1.0','CURRENT_PROJECT_VERSION':'1'}
app_config=configurations('app',app_settings)
test_config=configurations('test',{'PRODUCT_NAME':'$(TARGET_NAME)','PRODUCT_BUNDLE_IDENTIFIER':'org.heimenzc.timefog.uitests','GENERATE_INFOPLIST_FILE':'YES','TEST_TARGET_NAME':'TimeFog','CODE_SIGN_STYLE':'Automatic'})
proxy=obj('proxy','PBXContainerItemProxy','containerPortal = '+uid('project')+'; proxyType = 1; remoteGlobalIDString = '+uid('app')+'; remoteInfo = TimeFog;')
dependency=obj('dependency','PBXTargetDependency','target = '+uid('app')+'; targetProxy = '+proxy+';')
app=obj('app','PBXNativeTarget','buildConfigurationList = '+app_config+'; buildPhases = '+array([app_sources,app_frameworks,app_resources])+'; buildRules = (); dependencies = (); name = TimeFog; packageProductDependencies = '+array([core])+'; productName = TimeFog; productReference = '+app_product+'; productType = "com.apple.product-type.application";')
test=obj('test','PBXNativeTarget','buildConfigurationList = '+test_config+'; buildPhases = '+array([test_sources,test_frameworks])+'; buildRules = (); dependencies = '+array([dependency])+'; name = TimeFogUITests; productName = TimeFogUITests; productReference = '+test_product+'; productType = "com.apple.product-type.bundle.ui-testing";')
project_id=obj('project','PBXProject','attributes = {LastUpgradeCheck = 2630; TargetAttributes = {'+app+' = {CreatedOnToolsVersion = 26.3;}; '+test+' = {CreatedOnToolsVersion = 26.3; TestTargetID = '+app+';};};}; buildConfigurationList = '+project_config+'; compatibilityVersion = "Xcode 14.0"; developmentRegion = "zh-Hans"; hasScannedForEncodings = 0; knownRegions = (en,"zh-Hans",Base); mainGroup = '+main+'; packageReferences = '+array([package])+'; productRefGroup = '+products+'; projectDirPath = ""; projectRoot = ""; targets = '+array([app,test])+';')
(project/'project.pbxproj').write_text('// !$*UTF8*$!\n{archiveVersion = 1; classes = {}; objectVersion = 60; objects = {\n'+'\n'.join(k+' = '+v for k,v in objects.items())+'\n}; rootObject = '+project_id+';}\n')
scheme=project/'xcshareddata/xcschemes';scheme.mkdir(parents=True,exist_ok=True)
def reference(i,name):return f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{i}" BuildableName="{name}" BlueprintName="{name.split(".")[0]}" ReferencedContainer="container:TimeFog.xcodeproj"/>'
app_ref=reference(app,'TimeFog.app');test_ref=reference(test,'TimeFogUITests.xctest')
(scheme/'TimeFog.xcscheme').write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2630" version="1.7">
 <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{app_ref}</BuildActionEntry></BuildActionEntries></BuildAction>
 <TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables><TestableReference skipped="NO">{test_ref}</TestableReference></Testables></TestAction>
 <LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{app_ref}</BuildableProductRunnable></LaunchAction>
 <ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">{app_ref}</BuildableProductRunnable></ProfileAction>
 <AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>''')
print(project)
