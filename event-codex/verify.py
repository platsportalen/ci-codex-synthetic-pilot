"""Apply bounded, allowlisted AI/fixture diff in a key-free temporary runner."""
import pathlib
import subprocess
import sys

MAX_PATCH_BYTES = 8192

def verify_patch(patch_path):
    patch = pathlib.Path(patch_path).resolve()
    if not patch.is_file() or not 0 < patch.stat().st_size <= MAX_PATCH_BYTES:
        raise ValueError("invalid patch size")
    data = patch.read_bytes()
    if b"\x00" in data:
        raise ValueError("binary patch")
    source = data.decode("utf-8")
    if any(x in source for x in ("GIT binary patch", "new file mode", "old mode", "rename from", "copy from", "diff --cc")):
        raise ValueError("unsupported patch type")
    rows = subprocess.check_output(["git", "apply", "--numstat", str(patch)], text=True).splitlines()
    if len(rows) != 1:
        raise ValueError("exactly one changed file required")
    parts = rows[0].split("\t")
    if len(parts) != 3 or parts[2] != "sample.py" or not all(x.isdigit() for x in parts[:2]):
        raise ValueError("patch target not allowlisted")
    if not pathlib.Path("sample.py").is_file() or pathlib.Path("sample.py").is_symlink():
        raise ValueError("baseline invalid")
    subprocess.run(["git", "apply", "--check", str(patch)], check=True)
    subprocess.run(["git", "apply", str(patch)], check=True)
    subprocess.run([sys.executable, "test_result.py"], check=True)

if __name__ == "__main__":
    verify_patch(sys.argv[1])
