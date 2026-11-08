import importlib.util, pathlib, unittest
p=pathlib.Path(__file__).with_name('sample.py')
spec=importlib.util.spec_from_file_location('candidate',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Contract(unittest.TestCase):
 def test_sum(self): self.assertEqual(m.total([2,3]),5)
 def test_zero(self): self.assertEqual(m.total([0,2,0]),2)
 def test_empty(self): self.assertEqual(m.total([]),0)
 def test_reject(self):
  for values in ([-1],[True],[1.1],['2']):
   with self.assertRaises(ValueError): m.total(values)
if __name__=='__main__': unittest.main()
