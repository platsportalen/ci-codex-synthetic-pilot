import importlib.util
import pathlib
import unittest

candidate = pathlib.Path(__file__).with_name("sample.py")
spec = importlib.util.spec_from_file_location("candidate", candidate)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class Contract(unittest.TestCase):
    def test_positive(self):
        self.assertEqual(module.total([2, 3]), 5)
    def test_zero(self):
        self.assertEqual(module.total([0, 2, 0]), 2)
    def test_empty(self):
        self.assertEqual(module.total([]), 0)
    def test_reject(self):
        for values in ([-1], [True], [1.1], ["2"]):
            with self.assertRaises(ValueError):
                module.total(values)

if __name__ == "__main__":
    unittest.main()
