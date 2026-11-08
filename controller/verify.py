from pathlib import Path
import subprocess,sys
patch=Path(sys.argv[1]).resolve()
if not patch.is_file() or not 0<patch.stat().st_size<=8192: raise ValueError('size')
s=patch.read_text()
if any(t in s for t in ('GIT binary patch','new file mode','old mode','rename from','copy from')): raise ValueError('type')
rows=subprocess.check_output(['git','apply','--numstat',str(patch)],text=True).splitlines()
if len(rows)!=1: raise ValueError('one file only')
v=rows[0].split('\t')
if len(v)!=3 or v[2]!='sample.py' or not all(x.isdigit() for x in v[:2]): raise ValueError('path')
subprocess.run(['git','apply','--check',str(patch)],check=True)
subprocess.run(['git','apply',str(patch)],check=True)
subprocess.run([sys.executable,'test_result.py'],check=True)
