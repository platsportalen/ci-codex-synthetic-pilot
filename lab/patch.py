"""Data-only synthetic patch transport, no application source dependencies."""
from pathlib import Path
import difflib, subprocess, sys
HERE=Path(__file__).resolve().parent
def verify(path):
    path=Path(path).resolve()
    if not path.is_file() or not 0<path.stat().st_size<8192: raise ValueError('patch size')
    text=path.read_text()
    if any(t in text for t in ('GIT binary patch','new file mode','old mode','rename from','copy from')): raise ValueError('patch type')
    stat=subprocess.check_output(['git','apply','--numstat',str(path)],cwd=HERE,text=True).strip().split('\t')
    if len(stat)!=3 or stat[2]!='sample.py' or not all(s.isdigit() for s in stat[:2]): raise ValueError('path allowlist')
    subprocess.run(['git','apply','--check',str(path)],cwd=HERE,check=True)
    subprocess.run(['git','apply',str(path)],cwd=HERE,check=True)
    subprocess.run([sys.executable,'-m','unittest','test_baseline','test_acceptance'],cwd=HERE,check=True)
if __name__=='__main__':
    if sys.argv[1]=='fixture':
        old=(HERE/'sample.py').read_text();new=old.replace('v <= 0','v < 0').replace('positive integers required','nonnegative integers required')
        Path(sys.argv[2]).write_text(''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='a/sample.py',tofile='b/sample.py')))
    elif sys.argv[1]=='verify': verify(sys.argv[2])
    else: raise ValueError('unknown operation')
