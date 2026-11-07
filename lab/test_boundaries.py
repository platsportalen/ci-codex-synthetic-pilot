import tempfile, unittest
from pathlib import Path
from patch import verify
class Boundaries(unittest.TestCase):
    def test_reject(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'x.patch'
            for text in ('x'*8192,'GIT binary patch','new file mode 120000','--- a/private.py\n+++ b/private.py\n@@ -1 +1 @@\n-old\n+new\n'):
                p.write_text(text)
                with self.assertRaises(ValueError): verify(p)
if __name__=='__main__': unittest.main()
