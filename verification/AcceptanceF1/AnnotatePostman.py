"""Documentation-only refresh of the existing WORKING collection; no requests added."""
import json, pathlib, sys

SCOPE = ('F1 scope: LPN = Unsupported/Deferred; no LPN workflow is certified. '
         'Kitting K1 and AutoReplenishment R1 = verified. B3 None/Lot, no LPN, one source bin, '
         'whole-order allocate -> pick -> pack -> ship = verified; physical deduction occurs only at Pick. '
         'Legacy Wave/Serial pick = unsupported for B3. Crossdock = Deferred/Partial, not Stable. '
         'Live F1 RESULT remains PARTIAL: final live happy metric89/93, four Gemini429 failures retained. '
         'Deterministic provider fixtures certify backend contracts only, not live AI availability.')

def annotate(collection):
    collection['info']['description'] = collection['info'].get('description','').split('\n\nF1 scope:')[0]+'\n\n'+SCOPE
    def visit(items):
        for item in items:
            req=item.get('request')
            if req:
                url=req['url']; url=url.get('raw','') if isinstance(url,dict) else url
                note=''
                if 'process-crossdock' in url:
                    note='Deferred/Partial legacy crossdock. Expected409 for pending B3 direct-pick demand, without mutation. No-demand200 is advisory only; it does not certify receive/reservation/physical movement or make crossdock Stable.'
                elif 'create-wave-pick' in url or 'pick-verify' in url:
                    note='Legacy Wave/Serial route is unsupported for B3 direct-pick orders. This fixture intentionally expects409 after request validation; no wave/serial success or LPN support is claimed.'
                elif '/Kitting/' in url:
                    note='K1 verified: use API-created component/kit/bin IDs; ATP, occupancy, issue/receipt ledger checked by SQL acceptance. Serial/LPN unsupported. This command is not idempotent by request ID; do not blindly resubmit a successful assemble.'
                elif 'run-auto-replenish' in url:
                    note='R1 verified: positive target row and compatible donor ATP; repeat re-evaluates state and returns0 when full. No LPN/Serial/cross-warehouse movement is supported.'
                elif '/OutboundOrders/' in url and any(x in url for x in ['allocate-pick-task','/pick','/pack','/ship']):
                    note='B3 verified scope: None/Lot, no LPN/Serial, one source bin, whole order. Allocate reserves; Pick deducts physical once; Pack/Ship never deduct again. Terminal/invalid repeats are checked as expected rejection, not forced200.'
                if note: req['description']=req.get('description','').split('\n\nScope:')[0]+'\n\nScope: '+note
            visit(item.get('item',[]))
    visit(collection['item'])

if __name__=='__main__':
    root=pathlib.Path(__file__).resolve().parents[2]; out=root/'obj/F1/postman';out.mkdir(parents=True,exist_ok=True)
    path=pathlib.Path(sys.argv[1]); collection=json.loads(path.read_text(encoding='utf-8-sig'));annotate(collection)
    (out/path.name).write_text(json.dumps(collection,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    env=pathlib.Path(sys.argv[2]);(out/env.name).write_bytes(env.read_bytes())
    print('Existing collection descriptions updated; request tree/body/assertions unchanged.')
