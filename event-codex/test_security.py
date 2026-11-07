import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parent

class PatchSafety(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.work = pathlib.Path(self.tmp.name) / "work"
        self.work.mkdir()
        self.patch = pathlib.Path(self.tmp.name) / "candidate.patch"
        shutil.copyfile(ROOT / "sample-baseline.py", self.work / "sample.py")
        shutil.copyfile(ROOT / "test_result.py", self.work / "test_result.py")
        subprocess.run(["git", "init", "-q"], cwd=self.work, check=True, capture_output=True)
        subprocess.run([sys.executable, str(ROOT / "fixture.py"), str(self.patch)],
                       check=True, capture_output=True)

    def apply(self):
        return subprocess.run([sys.executable, str(ROOT / "verify.py"), str(self.patch)],
                              cwd=self.work, text=True, capture_output=True)

    def test_trusted_patch_passes_four_acceptance_cases(self):
        result = self.apply()
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_reject_wrong_path(self):
        patch = self.patch.read_text().replace("a/sample.py", "a/other.py").replace(
            "b/sample.py", "b/other.py")
        self.patch.write_text(patch)
        self.assertNotEqual(self.apply().returncode, 0)

    def test_reject_binary(self):
        self.patch.write_text("GIT binary patch\n")
        self.assertNotEqual(self.apply().returncode, 0)

    def test_reject_multi_file_patch(self):
        self.patch.write_text(self.patch.read_text() * 2)
        self.assertNotEqual(self.apply().returncode, 0)

    def test_reject_oversize(self):
        self.patch.write_text(self.patch.read_text() + "#" * 9000)
        self.assertNotEqual(self.apply().returncode, 0)

    def test_reject_empty(self):
        self.patch.write_text("")
        self.assertNotEqual(self.apply().returncode, 0)

if __name__ == "__main__":
    unittest.main()
