"""Certify final H2 source/docs/evidence and preservation, without rerunning tests."""
import hashlib,json,re,subprocess
from collections import Counter
from pathlib import Path
root=Path(__file__).resolve().parents[2];out=root/'obj/H2'
before=json.loads((out/'before.json').read_text())
production=[
 'SmartWMS.Api/Controllers/CycleCountingController.cs',
 'SmartWMS.Application/Features/CycleCounting/DTOs/Queries/CycleCountAssigneeDto.cs',
 'SmartWMS.Application/Features/CycleCounting/Queries/GetCycleCountAssignees/GetCycleCountAssigneesQuery.cs',
 'SmartWMS.Application/Features/CycleCounting/Queries/GetCycleCountAssignees/GetCycleCountAssigneesQueryHandler.cs',
 'SmartWMS.Application/Features/InventoryTransfers/Commands/CreateInventoryTransfer/CreateInventoryTransferCommandHandler.cs',
 'SmartWMS.Application/Features/Products/Commands/Create/CreateProductCommandHandler.cs',
 'SmartWMS.Application/Features/Products/Queries/GetList/GetProductListQueryHandler.cs',
 'SmartWMS.Application/Features/Products/Queries/GetPaginatedProducts/GetPaginatedProductsQueryHandler.cs',
 'SmartWMS.Application/Features/Products/Queries/GetProductById/GetProductByIdQueryHandler.cs']
verification=['verification/CoreHardeningH2/'+p for p in ['Audit.py','CoreHardeningH2.Verification.csproj','EmbeddingChecks.cs','HttpChecks.cs','PrepareMirror.py','Program.cs','RunRegression.py','VerificationEvidence.json']]
manifest=sorted(production+verification+['docs/FE_API_HANDOFF.md','docs/PHASE_H2.md'])
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else 'ABSENT'
for name,h in before['hashes'].items():
 if name not in manifest:assert sha(root/name)==h,('Unrelated path changed',name)
status=subprocess.check_output(['git','status','--short','--untracked-files=all'],cwd=root,text=True).splitlines()
protected=[s for s in before['status'] if s[3:]!='docs/FE_API_HANDOFF.md']
for line in protected:assert line in status,('Baseline status changed',line)
for name,h in before['postman'].items():assert sha(Path(name))==h,('Postman changed',name)
for name,h in json.loads((root/'obj/F1/exhaustive/preserved-evidence.json').read_text()).items():assert sha(root/name)==h,('F1 evidence changed',name)
assert subprocess.check_output(['git','branch','--show-current'],cwd=root,text=True).strip()=='main'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()==before['head']
assert not subprocess.check_output(['git','diff','--cached','--name-only'],cwd=root,text=True)
subprocess.run(['git','diff','--check'],cwd=root,check=True,capture_output=True)
for name in production+['verification/CoreHardeningH2/'+p for p in ['Program.cs','HttpChecks.cs','EmbeddingChecks.cs']]:assert sha(root/name)==sha(out/'source'/name),('Source differs from tested mirror',name)
doc=(root/'docs/FE_API_HANDOFF.md').read_text(encoding='utf-8')
rows=re.findall(r'^\| (GET|POST|PUT|DELETE|PATCH) \| (/api/v1/[^ |]+) \| ([SCEPU]) / ([^|]+) \|',doc,re.M)
source={(r['method'],r['route']) for r in json.loads((out/'routes.json').read_text())}
assert len(rows)==len(source)==97
assert source=={(m,p) for m,p,_,_ in rows}
runtime=json.loads((out/'full-regression/OutboundB3-http/openapi.json').read_text())
normalize=lambda p:re.sub(r'\{(\w+):[^}]+\}',r'{\1}',p)
actual={(verb.upper(),path) for path,ops in runtime['paths'].items() for verb in ops if verb in ('get','post','put','patch','delete')}
assert {(m,normalize(p)) for m,p in source}==actual and len(actual)==97
for target in re.findall(r'\]\(([^)]+)\)',doc):assert (root/'docs'/target.split('#')[0]).exists(),target
for name in manifest:
 if name.endswith('VerificationEvidence.json') and not (root/name).exists():continue
 s=(root/name).read_text(encoding='utf-8-sig')
 assert not re.search(r'AIza[0-9A-Za-z_-]{20,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|C:\\Users\\',s),('Secret/private path',name)
 assert all(line==line.rstrip() for line in s.splitlines()),('Whitespace',name)
focused=json.loads((out/'focused-final/summary.json').read_text());assert focused['complete'] and focused['passed']==focused['total']==253
runs=json.loads((out/'regression-summary.json').read_text());assert len(runs)==9 and all(r['exitCode']==0 and r['passed']==r['total'] for r in runs.values())
regression={}
for log in sorted((out/'full-regression').glob('*/run.log')):
 matches=re.findall(r'ALL (\d+) (?:\w+ )?CHECKS PASSED',log.read_text(encoding='utf-8-sig'));assert matches,log
 regression[log.parent.name]=int(matches[-1])
assert len(regression)==11 and sum(regression.values())==884
assert {k:runs[k]['passed'] for k in ('S1-http','S1-ownership','F1-relevant','F1-data','ReleaseHardening','DeleteRace','B2-summary','B2-migrations')}=={'S1-http':591,'S1-ownership':24,'F1-relevant':51,'F1-data':20,'ReleaseHardening':65,'DeleteRace':31,'B2-summary':15,'B2-migrations':25}
evidence={'H2_RESULT':'PASS','backendCoreStatus':'CLOSED','baseHead':before['head'],'committed':False,'liveGeminiCalls':0,'controllerRoutesBefore':96,'controllerRoutesAfter':97,'runtimeOpenApiExactMatch':True,'handoffExactRouteCoverage':True,'handoffReadinessCounts':dict(Counter(c for _,_,c,_ in rows)),'focused':focused,'relevantAndRegression':runs,'regressionSuites':regression,'fullRegressionChecks':884+65+31+15+25,'baselineDirtyPathsUnchanged':25,'b4Unchanged':True,'historicalVerificationUnchanged':True,'externalPostmanUnchanged':True,'externalPostmanHashes':{Path(n).name:h for n,h in before['postman'].items()},'indexEmpty':True,'migrationSchemaPackageChanges':'NONE','verifiedProductionHashes':{n:sha(root/n) for n in production},'manifest':manifest,'nextStep':'SYNC POSTMAN FINAL DELTA'}
(root/'verification/CoreHardeningH2/VerificationEvidence.json').write_text(json.dumps(evidence,indent=2)+'\n',encoding='utf-8')
status=subprocess.check_output(['git','status','--short','--untracked-files=all'],cwd=root,text=True).splitlines()
assert {s[3:] for s in status}-{s[3:] for s in protected}==set(manifest)
print(json.dumps({k:v for k,v in evidence.items() if k not in ('verifiedProductionHashes','externalPostmanHashes','manifest','regressionSuites')},indent=2))
print('Exact H2 manifest:',len(manifest),'files; baseline/B4/Postman preserved; index empty')
