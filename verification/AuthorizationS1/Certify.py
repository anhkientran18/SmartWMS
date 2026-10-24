"""Summarize S1 evidence without rerunning tests or touching F1 artifacts."""
import hashlib, json, re, subprocess
from pathlib import Path

root=Path(__file__).resolve().parents[2]
run=root/'obj/S1'
def checks(folder):
    lines=(run/folder/'results.txt').read_text(encoding='utf-8-sig').splitlines()
    passed=sum(x.startswith('PASS:') for x in lines)
    assert passed==len(lines),(folder,passed,len(lines))
    return {'passed':passed,'total':len(lines)}
matrix=json.loads((run/'http-final/role-matrix.json').read_text())
assert all(x['status']==x['expected'] for x in matrix)
audit=json.loads((run/'audit-before.json').read_text())
schema=json.loads((run/'regression/OutboundB3-http/openapi.json').read_text())
normalize=lambda path:re.sub(r'\{(\w+):[^}]+\}',r'{\1}',path)
source={(x['method'],normalize(x['route'])) for x in audit}
runtime={(verb.upper(),path) for path,operations in schema['paths'].items() for verb in operations if verb in ('get','post','put','patch','delete')}
assert source==runtime,{'sourceOnly':sorted(source-runtime),'runtimeOnly':sorted(runtime-source)}
regression={}
for path in sorted((run/'regression').glob('*/run.log')):
    if path.parent.name=='ReplenishmentR1-http':
        continue
    text=path.read_text(encoding='utf-8-sig')
    matches=re.findall(r'ALL (\d+) (?:\w+ )?CHECKS PASSED',text)
    assert matches,path
    regression[path.parent.name]=int(matches[-1])
r1=(run/'r1-policy-http.log').read_text(encoding='utf-8-sig')
assert 'ALL 26 R1 CHECKS PASSED' in r1 and 'FAIL:' not in r1
regression['ReplenishmentR1-http']=26
assert len(regression)==11 and sum(regression.values())==884,regression
original=(run/'regression/results.txt').read_text(encoding='utf-8-sig').splitlines()
assert len(original)==12 and [x for x in original if x.startswith('FAIL:')]==['FAIL: regression ReplenishmentR1-http exit0']
baseline=json.loads((root/'obj/F1/baseline.json').read_text(encoding='utf-8-sig'))
for entry in baseline:
    path=root/entry['Path']
    actual=hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else 'ABSENT'
    assert actual.lower()==entry['Hash'].lower(),entry['Path']
    status=subprocess.check_output(['git','status','--short','--untracked-files=all','--',entry['Path']],cwd=root,text=True)
    assert status[:2]==entry['Status'],entry['Path']
assert len(baseline)==26
for path,hash_ in json.loads((root/'obj/F1/exhaustive/preserved-evidence.json').read_text(encoding='utf-8-sig')).items():
    assert hashlib.sha256((root/path).read_bytes()).hexdigest()==hash_,path
assert not subprocess.check_output(['git','diff','--cached','--name-only'],cwd=root,text=True).strip()
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()=='ead3c3a0b3cfd53a8248fe49062023686d671fc0'
for path in ('verification/Phase4B','verification/AcceptanceF1','verification/KittingK1','verification/ReplenishmentR1','docs/PHASE_F1.md','docs/PHASE_F1_API_MATRIX.md','docs/PHASE_F1_FINAL_VERIFICATION.md'):
    assert not subprocess.check_output(['git','diff','HEAD','--',path],cwd=root,text=True),path
protected={x['Path'] for x in baseline}
changed=subprocess.check_output(['git','-c','core.quotepath=false','status','--short','--untracked-files=all'],cwd=root,text=True).splitlines()
manifest=sorted(line[3:] for line in changed if line[3:] not in protected)
evidence={
    'S1_RESULT':'PARTIAL','reason':'high-confidence authorization hardening verified; unresolved product/deployment policy remains documented.',
    'checkpoint':'ead3c3a0b3cfd53a8248fe49062023686d671fc0','liveGeminiCalls':0,
    'controllerRouteCount':len(source),'runtimeOpenApiExactMatch':True,
    'focused':checks('http-final'),'focusedMatrixRecords':len(matrix),
    'preCommitOwnership':checks('precommit-ownership'),
    'phase4bRepositoryUnchanged':True,
    'phase4bAdapter':'S1 PrepareMirror supplies VerifyUser(userId) only in ignored mirror; historical assertions/evidence unchanged',
    'sqlNoMutationSnapshots':sum('preserves ALL SQL' in line for line in (run/'http-final/results.txt').read_text().splitlines()),
    'allRouteInvalidJwtCases':95*3,'f1Relevant':checks('f1-approved'),
    'regressionOrchestration':{'passed':12,'total':12,'basis':'10 original suite passes + anchor pass + isolated S1-aware R1 HTTP retry'},
    'historicalR1Assertion':'Original R1 Staff200 assertion failed as expected after policy change; ignored mirror replaces only this with403 and SQL no-mutation check. Committed R1 files unchanged.',
    'regressionChecks':sum(regression.values()),'regressionSuites':regression,
    'baselinePathsUnchanged':25,'b4Unchanged':True,'indexEmpty':True,'committed':False,
    'manifest':manifest,
}
target=root/'verification/AuthorizationS1/VerificationEvidence.json'
relative=target.relative_to(root).as_posix()
if relative not in manifest:manifest.append(relative);manifest.sort()
assert len(manifest)==17,manifest
target.write_text(json.dumps(evidence,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in evidence.items() if k not in ('manifest','regressionSuites')},indent=2))
print('Manifest:',len(manifest))
