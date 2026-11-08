from pathlib import Path
import tempfile,subprocess,sys,difflib,yaml,shutil
root=Path(__file__).resolve().parents[1]
w=yaml.safe_load((root/'.github/workflows/codex-candidate.yml').read_text());jobs=w['jobs'];paid=jobs['codex']
assert paid['if']=='${{ success() }}', 'Only successful validation may reach the Environment gate'
assert w['concurrency']=={'group':'synthetic-codex-single-step-v1','cancel-in-progress':False}
assert "process.env.CONTROL_APPROVED_SHA!==context.sha" in paid['steps'][0]['with']['script']
assert "filter:'all'" in paid['steps'][0]['with']['script']
assert "attempt!==1" in paid['steps'][0]['with']['script']
assert paid['needs']=='validate' and paid['environment']=='synthetic-pilot-approval'
assert paid['permissions']=={'contents':'read','actions':'read','pull-requests':'read'}
assert not any('checkout@' in s.get('uses','') for s in paid['steps'])
refs=[s for s in paid['steps'] if 'secrets.' in str(s)]
assert len(refs)==1 and refs[0]['uses'].startswith('openai/codex-action@')
assert refs[0]['with']['safety-strategy']=='drop-sudo'
assert refs[0]['with']['openai-api-key']=='${{ secrets.OPENAI_API_KEY }}'
assert all('secrets.' not in str(v) and 'environment' not in v for k,v in jobs.items() if k!='codex')
assert jobs['verify']['needs']==['validate','codex']
assert 'assertScope' in paid['steps'][0]['with']['script'] and "require('./" not in paid['steps'][0]['with']['script']
# Exercise exact patched acceptance and adversarial paths without any API.
with tempfile.TemporaryDirectory() as tmp:
 d=Path(tmp);src=(root/'controller/baseline.txt').read_text();(d/'sample.py').write_text(src)
 for name in ('verify.py','test_result.py'):shutil.copy(root/'controller'/name,d/name)
 subprocess.run(['git','init','-q'],cwd=d,check=True)
 changed=src.replace('v <= 0','v < 0')
 patch=d/'candidate.patch';patch.write_text(''.join(difflib.unified_diff(src.splitlines(True),changed.splitlines(True),fromfile='a/sample.py',tofile='b/sample.py')))
 subprocess.run([sys.executable,'verify.py',str(patch)],cwd=d,check=True)
 for bad in ('x'*8193,'GIT binary patch','new file mode 120000','--- a/other.py\n+++ b/other.py\n@@ -1 +1 @@\n-old\n+new\n'):
  patch.write_text(bad)
  result=subprocess.run([sys.executable,'verify.py',str(patch)],cwd=d,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  assert result.returncode!=0
print('Static secret-boundary audit, acceptance and 4 adversarial patch checks passed')
