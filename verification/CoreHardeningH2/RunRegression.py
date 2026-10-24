"""Run the unchanged historical suites against the H2 ignored mirror and fixtures.

Prerequisites: PrepareMirror.py, mirror API/H2 builds, and green H2 focused-final.
No live Gemini, shared DB, original obj/bin build, or external Postman writes.
"""
import json,os,re,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parents[2];out=root/'obj/H2';mirror=out/'source'
api=mirror/'SmartWMS.Api/bin/Debug/net10.0/SmartWMS.Api.dll'
if '--with-focused' in sys.argv:
 command=['dotnet',str(mirror/'verification/CoreHardeningH2/bin/Debug/net10.0/CoreHardeningH2.Verification.dll'),str(out/'focused-final'),str(api)]
 with (out/'focused-final-run.log').open('w',encoding='utf-8') as log:
  focused_run=subprocess.run(command,cwd=root,stdout=log,stderr=subprocess.STDOUT,timeout=900)
 assert focused_run.returncode==0,'Focused H2 failed; inspect focused-final-run.log'
 print('H2 focused PASS',flush=True)
focused=(out/'focused-final/results.txt').read_text(encoding='utf-8-sig').splitlines()
assert focused and all(s.startswith('PASS:') for s in focused),'Focused H2 must pass first'
assert json.loads((out/'focused-final/summary.json').read_text())['complete'],'Focused H2 must finish all checks'
env=os.environ.copy();env['S1_REPO']=str(root);env['F1_REPO']=str(root)
resume='--resume' in sys.argv
for suite in (() if resume else ('Phase4A','Phase4B','InboundB1','OutboundB3','KittingK1','ReplenishmentR1','AcceptanceF1','AuthorizationS1','ReleaseHardening','BackendB2')):
 with (out/f'build-{suite}.log').open('w',encoding='utf-8') as log:
  result=subprocess.run(['dotnet','build',str(mirror/f'verification/{suite}/{suite}.Verification.csproj'),'--nologo','-v','quiet','-p:NuGetAudit=false','--ignore-failed-sources'],cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT)
 assert result.returncode==0,suite+' build failed'
 print('BUILD PASS',suite,flush=True)
runs=[('S1-http','AuthorizationS1','--http',str(api)),('S1-ownership','AuthorizationS1','--ownership','unused'),('F1-relevant','AuthorizationS1','--f1-relevant','unused'),('F1-data','AcceptanceF1','--data','unused'),('full-regression','AuthorizationS1','--regression',str(mirror)),('ReleaseHardening','ReleaseHardening','--verify-localdb',None),('DeleteRace','ReleaseHardening','--verify-delete-races',None),('B2-summary','BackendB2','--summary',str(api)),('B2-migrations','BackendB2','--migrations',None)]
summary=json.loads((out/'regression-summary.json').read_text()) if resume else {}
for name,suite,mode,extra in runs:
 folder=out/name;folder.mkdir(exist_ok=True)
 result_file=folder/({'ReleaseHardening':'handler-results.txt','DeleteRace':'delete-race-results.txt'}.get(name,'results.txt'))
 existing=result_file.read_text(encoding='utf-8-sig').splitlines() if result_file.exists() else []
 if resume and summary.get(name,{}).get('exitCode')==0 and existing and all(s.startswith('PASS:') for s in existing):
  summary[name]={'exitCode':0,'passed':len(existing),'total':len(existing)}
  (out/'regression-summary.json').write_text(json.dumps(summary,indent=2))
  print('PRESERVED PASS',name,len(existing),flush=True);continue
 command=['dotnet',str(mirror/f'verification/{suite}/bin/Debug/net10.0/{suite}.Verification.dll'),mode,str(folder)]
 if extra is not None:command.append(extra)
 with (folder/'run.log').open('w',encoding='utf-8') as log:
  run=subprocess.run(command,cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=1800)
 lines=result_file.read_text(encoding='utf-8-sig').splitlines() if result_file.exists() else []
 passed=sum(s.startswith('PASS:') for s in lines)
 summary[name]={'exitCode':run.returncode,'passed':passed,'total':len(lines)}
 (out/'regression-summary.json').write_text(json.dumps(summary,indent=2))
 print(name,summary[name],flush=True)
 assert run.returncode==0 and lines and passed==len(lines),name+' failed; see run.log'
print('ALL H2 RELEVANT AND REGRESSION SUITES PASS',flush=True)
