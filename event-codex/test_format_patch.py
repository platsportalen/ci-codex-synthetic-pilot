"""No-secret tests for preserving all source patch bytes except final LF."""
import hashlib
import unittest

from format_patch import normalize_final_lf


class FormatPatchTest(unittest.TestCase):
    def test_append_only_one_lf(self):
        original = b"--- a/sample.py\n+++ b/sample.py\n@@ -1 +1 @@\n-old\n+new"
        got = normalize_final_lf(original, hashlib.sha256(original).hexdigest())
        self.assertEqual(got, original + b"\n")

    def test_keep_already_correct(self):
        original = b"--- a/sample.py\n+++ b/sample.py\n@@ -1 +1 @@\n-old\n+new\n"
        self.assertEqual(normalize_final_lf(original), original)

    def test_reject_wrong_digest(self):
        with self.assertRaises(ValueError):
            normalize_final_lf(b"valid data", "a" * 64)

    def test_reject_empty(self):
        with self.assertRaises(ValueError):
            normalize_final_lf(b"")

    def test_reject_oversize(self):
        with self.assertRaises(ValueError):
            normalize_final_lf(b"x" * 8193)

    def test_reject_addition_beyond_limit(self):
        with self.assertRaises(ValueError):
            normalize_final_lf(b"x" * 8192)

    def test_reject_binary_nul(self):
        with self.assertRaises(ValueError):
            normalize_final_lf(b"x\x00")

    def test_reject_invalid_utf8(self):
        with self.assertRaises(UnicodeDecodeError):
            normalize_final_lf(b"\xff")

    def test_reject_bad_digest_string(self):
        with self.assertRaises(ValueError):
            normalize_final_lf(b"valid", "bad")


if __name__ == "__main__":
    unittest.main()
