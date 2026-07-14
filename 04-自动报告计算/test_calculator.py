import json
import math
import unittest
from pathlib import Path

from lab_report_calculator import (
    InputError,
    calculate_all,
    calculate_beam_bending,
    calculate_beam_deformation,
    calculate_bending_torsion,
    calculate_elastic_constants,
)


class CalculatorRegressionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        root = Path(__file__).resolve().parent
        payload = json.loads((root / "sample_input.json").read_text(encoding="utf-8"))
        cls.elastic_input = payload["experiments"]["elastic_constants"]
        cls.bending_torsion_input = payload["experiments"]["bending_torsion"]
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
        self.assertEqual(result["channel_pairing"]["axial_channels"], [0, 3])
        self.assertEqual(result["channel_pairing"]["transverse_channels"], [1, 2])
        self.assertEqual(len(result["stress_strain_curve"]), 4)

    def test_elastic_channels_are_detected_after_reordering(self):
        data = json.loads(json.dumps(self.elastic_input))
        order = [1, 3, 2, 0]
        for run in data["runs"]:
            run["readings_micro"] = [
                [row[index] for index in order]
                for row in run["readings_micro"]
            ]
        data["axial_channels"] = [0, 2]
        data["transverse_channels"] = [1, 3]

        result = calculate_elastic_constants(data)

        self.assertEqual(result["channel_pairing"]["axial_channels"], [1, 3])
        self.assertEqual(result["channel_pairing"]["transverse_channels"], [0, 2])
        self.assertAlmostEqual(result["E_mean_MPa"], self.result["elastic_constants"]["E_mean_MPa"], places=6)
        self.assertAlmostEqual(result["mu_mean"], self.result["elastic_constants"]["mu_mean"], places=8)

    def test_shear_modulus(self):
        result = self.result["shear_modulus"]
        selected = result["half_bridge_method"]["runs"][1]
        self.assertAlmostEqual(result["dial_method"]["G_report_MPa"] / 1000.0, 27.727, places=3)
        self.assertAlmostEqual(result["half_bridge_method"]["G_report_MPa"] / 1000.0, 26.434, places=3)
        self.assertAlmostEqual(selected["report_delta_gamma_1_micro"], 176.75, places=2)
        self.assertAlmostEqual(selected["report_delta_gamma_2_micro"], 178.25, places=2)
        self.assertAlmostEqual(selected["report_delta_gamma_micro"], 177.5, places=2)
        self.assertAlmostEqual(result["dial_method"]["G_mean_MPa"] / 1000.0, 28.5435, places=3)

    def test_beams(self):
        bending = self.result["beam_bending"]
        deformation = self.result["beam_deformation"]
        self.assertEqual(bending["gage_order"], ["1", "2", "3", "4", "5", "7", "8", "9", "10"])
        self.assertEqual([len(row) for row in bending["raw_readings_micro"]], [9, 9])
        point_3 = next(point for point in bending["points"] if point["gage"] == "3")
        self.assertTrue(point_3["valid"])
        self.assertAlmostEqual(point_3["strain_micro"], -124.5, places=2)
        self.assertAlmostEqual(point_3["stress_experimental_MPa"], -26.145, places=3)
        self.assertAlmostEqual(bending["full_bridge"]["max_strain_micro"], -156.0, places=2)
        self.assertAlmostEqual(deformation["simply_supported"]["deflection_theoretical_mm"], 0.5565, places=3)
        self.assertEqual(
            deformation["cantilever"]["raw_strain_readings_micro"],
            [[151.0, 66.0], [151.0, 65.0], [152.0, 65.0], [151.0, 64.0]],
        )
        self.assertEqual(deformation["cantilever"]["strain_differences_micro"], [85.0, 86.0, 87.0, 87.0])
        self.assertAlmostEqual(deformation["cantilever"]["mean_strain_group_1_micro"], 151.25, places=2)
        self.assertAlmostEqual(deformation["cantilever"]["mean_strain_group_2_micro"], 65.0, places=2)
        self.assertAlmostEqual(deformation["cantilever"]["strain_difference_micro"], 86.25, places=2)
        self.assertAlmostEqual(deformation["cantilever"]["mass_kg"], 0.7123, places=3)

    def test_beam_bending_rejects_non_nine_column_rows(self):
        data = json.loads(
            (Path(__file__).resolve().parent / "sample_input.json").read_text(encoding="utf-8")
        )["experiments"]["beam_bending"]
        data["point_readings_micro"][0].pop()
        with self.assertRaisesRegex(InputError, "必须按测点 1、2、3、4、5、7、8、9、10 输入 9 列"):
            calculate_beam_bending(data)

    def test_cantilever_rejects_rows_without_two_raw_readings(self):
        data = json.loads(
            (Path(__file__).resolve().parent / "sample_input.json").read_text(encoding="utf-8")
        )["experiments"]["beam_deformation"]
        data["cantilever"]["strain_readings_micro"][0].pop()
        with self.assertRaisesRegex(InputError, "必须输入第 1 组和第 2 组共 2 列原始应变读数"):
            calculate_beam_deformation(data)

    def test_combined_loading(self):
        result = self.result["bending_torsion"]
        for surface in ("upper", "lower"):
            angles = [
                point["angle_deg"]
                for point in self.bending_torsion_input["rosettes"][surface]["measurement_points"]
            ]
            self.assertEqual(angles, [45.0, 0.0, -45.0])
        self.assertAlmostEqual(result["bending_bridge"]["moment_measured_Nmm"] / 1000.0, 970.87, places=1)
        self.assertAlmostEqual(result["torsion_bridge"]["torque_measured_Nmm"] / 1000.0, 811.46, places=1)

    def test_quarter_bridge_accepts_arbitrary_measurement_angles(self):
        data = json.loads(json.dumps(self.bending_torsion_input))
        baseline = self.result["bending_torsion"]
        custom_angles = [-20.0, 25.0, 80.0]
        for surface_index, surface in enumerate(("upper", "lower")):
            components = baseline["surface_results"][surface_index]["experimental"]
            ex = components["epsilon_x_micro"]
            ey = components["epsilon_y_micro"]
            gamma = components["gamma_xy_micro"]
            for point, angle_deg in zip(data["rosettes"][surface]["measurement_points"], custom_angles):
                angle = math.radians(angle_deg)
                strain = ex * math.cos(angle) ** 2 + ey * math.sin(angle) ** 2 - gamma * math.sin(angle) * math.cos(angle)
                point["angle_deg"] = angle_deg
                point["readings_micro"] = [strain] * 4

        result = calculate_bending_torsion(data)

        for surface_index in range(2):
            expected = baseline["surface_results"][surface_index]["experimental"]
            actual = result["surface_results"][surface_index]["experimental"]
            self.assertAlmostEqual(actual["sigma_1_MPa"], expected["sigma_1_MPa"], places=8)
            self.assertAlmostEqual(actual["sigma_2_MPa"], expected["sigma_2_MPa"], places=8)
            self.assertAlmostEqual(actual["principal_angle_deg"], expected["principal_angle_deg"], places=8)
        self.assertEqual(result["bending_bridge"], baseline["bending_bridge"])
        self.assertEqual(result["torsion_bridge"], baseline["torsion_bridge"])

    def test_quarter_bridge_rejects_singular_angle_configuration(self):
        data = json.loads(json.dumps(self.bending_torsion_input))
        for point in data["rosettes"]["upper"]["measurement_points"]:
            point["angle_deg"] = 0
        with self.assertRaisesRegex(InputError, "方位角组合无法唯一确定平面应变"):
            calculate_bending_torsion(data)

    def test_eccentric_tension(self):
        result = self.result["eccentric_tension"]
        self.assertAlmostEqual(result["E_MPa"] / 1000.0, 194.301, places=3)
        self.assertAlmostEqual(result["eccentricity_mm"], 19.665, places=3)


if __name__ == "__main__":
    unittest.main()
