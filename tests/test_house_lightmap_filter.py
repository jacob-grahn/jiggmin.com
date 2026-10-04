import sys, unittest, json
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scene/scripts'))
from house_lightmap_filter import speckle_score, filter_irradiance

class SpeckleTests(unittest.TestCase):
    def test_solid_and_gradient(self):
        self.assertEqual(speckle_score(np.ones((48,48))),0)
        self.assertLess(speckle_score(np.tile(np.linspace(.1,1,48),(48,1))),.0001)
    def test_calibrated_contrast(self):
        pattern=np.indices((48,48)).sum(axis=0)%2
        self.assertAlmostEqual(speckle_score(pattern),1,places=3)
        self.assertAlmostEqual(speckle_score(.25+.5*pattern),.5,places=3)
    def test_historical_defect_fails_guard(self):
        fixture=json.loads((Path(__file__).parent/'fixtures/hall-trim-speckle.json').read_text())
        patch=np.array(fixture['lighting'],dtype=np.float32)
        with self.assertRaisesRegex(RuntimeError,'speckle guard'):
            filter_irradiance(patch,[(0,(0,0,13,64),np.ones((64,13),bool))],sigma=0)
        out,report=filter_irradiance(patch,[(0,(0,0,13,64),np.ones((64,13),bool))])
        self.assertLess(speckle_score(out),.01)
    def test_invalid_and_empty_masks(self):
        for a in [np.full((12,12),np.nan),-np.ones((12,12))]:
            with self.assertRaises(ValueError):speckle_score(a)
        with self.assertRaises(ValueError):speckle_score(np.ones((12,12)),np.zeros((12,12),bool))
    def test_preserves_gradient_and_isolates_neighbors(self):
        image=np.zeros((48,96,3),np.float32);image[:,:48]=.2;image[:,48:]=10
        mask=np.ones((48,48),bool)
        out,report=filter_irradiance(image,[(0,(0,0,48,48),mask),(1,(48,0,96,48),mask)])
        np.testing.assert_allclose(out[:,:48],.2,atol=1e-6)
        np.testing.assert_array_equal(out[:,48:],image[:,48:])
        self.assertLess(report[0]['filteredScore'],.001)
    def test_real_noise_reduced_without_touching_albedo(self):
        noise=np.random.default_rng(10).uniform(0,.4,(64,32,3)).astype(np.float32)
        out,report=filter_irradiance(noise,[(0,(0,0,32,64),np.ones((64,32),bool))])
        self.assertGreater(report[0]['rawScore'],.15)
        self.assertLess(report[0]['filteredScore'],.02)
        self.assertAlmostEqual(float(out.mean()),float(noise.mean()),delta=.01)

if __name__=='__main__':unittest.main()
