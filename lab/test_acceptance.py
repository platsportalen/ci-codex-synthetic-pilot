import unittest
from sample import total
class NextStep(unittest.TestCase):
    def test_zero_supported(self): self.assertEqual(total([0,2,0]),2)
if __name__=='__main__': unittest.main()

# Stage 5.2 synthetic second-step CI event; no behavior change.
