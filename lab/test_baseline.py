import unittest
from sample import total
class ExistingBehavior(unittest.TestCase):
    def test_sum(self): self.assertEqual(total([2,3]),5)
    def test_empty(self): self.assertEqual(total([]),0)
    def test_stage4_negative(self): self.assertEqual(total([2,3]),6)  # deliberate red CI test
    def test_bad(self):
        for values in ([-1],[True],[1.2],["2"]):
            with self.assertRaises(ValueError): total(values)
if __name__=='__main__': unittest.main()
