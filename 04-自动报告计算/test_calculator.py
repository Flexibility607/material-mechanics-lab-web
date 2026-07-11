import json
import unittest
from pathlib import Path

from lab_report_calculator import calculate_all


class CalculatorRegressionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        root = Path(__file__).resolve().parent
        payload = json.loads((root / "sample_input.json").read_text(encoding="utf-8"))
        cls.result = calculate_all(payload)["results"]

    def test_mechanical_properties(self):
        steel = self.result["mechanical_properties"]["tension"][0]
        self.assertAlmostEqual(steel["yield_strength_MPa"], 312.20, places=2)
        self.assertAlmostEqual(steel["tensile_strength_MPa"], 448.82, places=2)

    def test_elastic_constants(self):
        result = self.result["elastic_constants"]
        self.assertAlmostEqual(result["E_mean_MPa"] / 1000.0, 68.0631, places=3)
        self.assertAlmostEqual(result["mu_mean"], 0.32631, places=4)
        self.assertGreater(result["stress_strain_fit"]["r2"], 0.9999)

    def test_shear_modulus(self):
        result = self.result["shear_modulus"]
        self.assertAlmostEqual(result["dial_method"]["G_report_MPa"] / 1000.0, 27.727, places=3)
        self.assertAlmostEqual(result["half_bridge_method"]["G_report_MPa"] / 1000.0, 26.434, places=3)
        self.assertAlmostEqual(result["dial_method"]["G_mean_MPa"] / 1000.0, 28.5435, places=3)

    def test_beams(self):
        bending = self.result["beam_bending"]
        deformation = self.result["beam_deformation"]
        self.assertAlmostEqual(bending["full_bridge"]["max_strain_micro"], -156.0, places=2)
        self.assertAlmostEqual(deformation["simply_supported"]["deflection_theoretical_mm"], 0.5565, places=3)
        self.assertAlmostEqual(deformation["cantilever"]["mass_kg"], 0.7123, places=3)

    def test_combined_loading(self):
        result = self.result["bending_torsion"]
        self.assertAlmostEqual(result["bending_bridge"]["moment_measured_Nmm"] / 1000.0, 970.87, places=1)
        self.assertAlmostEqual(result["torsion_bridge"]["torque_measured_Nmm"] / 1000.0, 811.46, places=1)

    def test_eccentric_tension(self):
        result = self.result["eccentric_tension"]
        self.assertAlmostEqual(result["E_MPa"] / 1000.0, 194.301, places=3)
        self.assertAlmostEqual(result["eccentricity_mm"], 19.665, places=3)


if __name__ == "__main__":
    unittest.main()
