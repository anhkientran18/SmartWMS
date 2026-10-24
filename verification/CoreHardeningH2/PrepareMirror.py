"""Build only this ignored mirror. Historical repository verification stays untouched.

Carry forward the reviewed S1 fixture adapters, and point S1's route inventory at
H2's 97-route inventory. No assertions about H2 are removed or weakened.
"""
import json,re,shutil,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2];mirror=root/'obj/H2/source';mirror.mkdir(parents=True,exist_ok=True)
tracked=subprocess.check_output(['git','ls-files'],cwd=root,text=True).splitlines()
untracked=subprocess.check_output(['git','ls-files','--others','--exclude-standard','SmartWMS.Application','verification/CoreHardeningH2'],cwd=root,text=True).splitlines()
for name in sorted(set(tracked+untracked)):
 p=Path(name)
 if any(s in ('obj','bin') for s in p.parts) or p.suffix not in ('.cs','.csproj','.json','.slnx','.resx'):continue
 dest=mirror/p;dest.parent.mkdir(parents=True,exist_ok=True)
 if name=='SmartWMS.Infrastructure/Services/PasswordHasher.cs':dest.write_bytes(subprocess.check_output(['git','show','HEAD:'+name],cwd=root))
 else:shutil.copyfile(root/p,dest)
for phase in ('Phase4A','Phase4B'):
 p=mirror/f'verification/{phase}/Program.cs';s=p.read_text(encoding='utf-8-sig')
 s=re.sub(r'(?m)^(?:const string business|var production) = .*;\r?$',lambda m:('var business' if m[0].startswith('const') else 'var production')+' = Environment.GetEnvironmentVariable("F1_REGRESSION_ANCHOR") ?? throw new InvalidOperationException("H2 fixture anchor required");',s)
 if phase=='Phase4B':
  old='new ConfirmCycleCountCommandHandler(db, new InventoryMutationCoordinator(db), new CycleCountCoordinator(db))'
  assert s.count(old)==1;s=s.replace(old,'new ConfirmCycleCountCommandHandler(db, new InventoryMutationCoordinator(db), new CycleCountCoordinator(db), new VerifyUser(userId))')
 p.write_text(s,encoding='utf-8')
p=mirror/'verification/ReplenishmentR1/HttpSmoke.cs';s=p.read_text(encoding='utf-8-sig')
old='await Login("r1-staff"); await Post(0, "existing Authorize contract permits authenticated Staff (unchanged role policy)");'
assert s.count(old)==1
s=s.replace(old,'''await Login("r1-staff");
            var deniedBefore = await FixtureDatabase.Snapshot(fixture.Connection);
            using (var denied = await http.PostAsJsonAsync(route, new { })) check(denied.StatusCode == HttpStatusCode.Forbidden, "S1 Staff auto-replenish403 (reviewed mirror adapter)");
            check(deniedBefore == await FixtureDatabase.Snapshot(fixture.Connection), "S1 Staff refill no SQL mutation");''')
p.write_text(s,encoding='utf-8')
p=mirror/'verification/AuthorizationS1/AuthorizationChecks.cs';s=p.read_text(encoding='utf-8-sig')
assert 'obj/S1/audit-before.json' in s;s=s.replace('obj/S1/audit-before.json','obj/H2/routes.json');p.write_text(s,encoding='utf-8')
routes=[]
for p in (root/'SmartWMS.Api/Controllers').glob('*.cs'):
 s=p.read_text(encoding='utf-8-sig');head,body=re.split(r'public (?:sealed )?class \w+',s,maxsplit=1)
 prefix=re.search(r'\[Route\("([^"]+)"\)\]',head)[1].replace('{version:apiVersion}','1').replace('[controller]',p.stem.removesuffix('Controller'))
 for m in re.finditer(r'\[Http(Get|Post|Put|Delete|Patch)(?:\("([^"]*)"\))?\]',body):routes.append({'method':m[1].upper(),'route':'/'+prefix+('/'+m[2] if m[2] else '')})
assert len(routes)==97
(root/'obj/H2/routes.json').write_text(json.dumps(routes,indent=2))
print(mirror);print('Controller actions:',len(routes))
