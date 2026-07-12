import json
import unittest
from pathlib import Path


SAMPLE_PATH = Path(__file__).with_name("sample_input.json")

# Counts audited against the handwritten-report Markdown tables. A tuple with two
# values means matrix rows x columns; a one-value tuple means a series/item count.
EXPECTED_SHAPES = {
    "mechanical_properties": {
        "tension": (2,),
        "tension.0.d0_measurements_mm": (18,),
        "tension.0.d1_mm": (3,),
        "tension.0.l0_mm": (3,),
        "tension.0.l1_mm": (3,),
        "compression": (2,),
        "torsion": (2,),
    },
    "elastic_constants": {
        "width_mm": (3,),
        "thickness_mm": (3,),
        "axial_channels": (2,),
        "transverse_channels": (2,),
        "runs": (3,),
        "runs.0.loads_kN": (5,),
        "runs.0.readings_micro": (5, 4),
        "runs.1.loads_kN": (5,),
        "runs.1.readings_micro": (5, 4),
        "runs.2.loads_kN": (5,),
        "runs.2.readings_micro": (5, 4),
    },
    "shear_modulus": {
        "diameter_mm": (4,),
        "dial_run.loads_kN": (5,),
        "dial_run.dial_mm": (5,),
        "half_bridge_runs": (2,),
        "half_bridge_runs.0.loads_kN": (5,),
        "half_bridge_runs.0.channel_1_micro": (5,),
        "half_bridge_runs.0.channel_2_micro": (5,),
        "half_bridge_runs.1.loads_kN": (5,),
        "half_bridge_runs.1.channel_1_micro": (5,),
        "half_bridge_runs.1.channel_2_micro": (5,),
        "full_bridge.loads_kN": (5,),
        "full_bridge.readings_micro": (5,),
    },
    "beam_bending": {
        "width_mm": (3,),
        "height_mm": (3,),
        "longitudinal_points": (7,),
        "longitudinal_points.0.readings_micro": (2,),
        "longitudinal_points.2.readings_micro": (2,),
        "longitudinal_points.3.readings_micro": (2,),
        "longitudinal_points.4.readings_micro": (2,),
        "longitudinal_points.5.readings_micro": (2,),
        "longitudinal_points.6.readings_micro": (2,),
        "poisson_surfaces": (2,),
        "poisson_surfaces.0.longitudinal_micro": (2,),
        "poisson_surfaces.0.transverse_micro": (2,),
        "poisson_surfaces.1.longitudinal_micro": (2,),
        "poisson_surfaces.1.transverse_micro": (2,),
        "full_bridge.readings_micro": (1,),
    },
    "beam_deformation": {
        "simply_supported.length_mm": (3,),
        "simply_supported.width_mm": (3,),
        "simply_supported.height_mm": (3,),
        "simply_supported.central_deflection_mm": (4,),
        "simply_supported.angle_indicator_delta_mm": (4,),
        "simply_supported.reciprocity_12_mm": (4,),
        "simply_supported.reciprocity_21_mm": (4,),
        "simply_supported.curve_points": (3,),
        "cantilever.width_mm": (3,),
        "cantilever.height_mm": (3,),
        "cantilever.strain_position_1_micro": (4,),
        "cantilever.strain_position_2_micro": (4,),
    },
    "bending_torsion": {
        "diameter_mm": (3,),
        "rosettes.upper.epsilon_p45_micro": (4,),
        "rosettes.upper.epsilon_0_micro": (4,),
        "rosettes.upper.epsilon_m45_micro": (4,),
        "rosettes.lower.epsilon_p45_micro": (4,),
        "rosettes.lower.epsilon_0_micro": (4,),
        "rosettes.lower.epsilon_m45_micro": (4,),
        "half_bridge_bending.readings_micro": (4,),
        "full_bridge_torsion.readings_micro": (4,),
    },
    "eccentric_tension": {
        "quarter_bridge_epsilon_a_micro": (4,),
        "quarter_bridge_epsilon_b_micro": (4,),
        "full_bridge_2epsilon_F_micro": (4,),
        "half_bridge_2epsilon_M_micro": (4,),
    },
}


def value_at(root, dotted_path):
    value = root
    for part in dotted_path.split("."):
        value = value[int(part)] if part.isdigit() else value[part]
    return value


def shape(value):
    if not isinstance(value, list):
        raise TypeError(f"Expected list, got {type(value).__name__}")
    if value and isinstance(value[0], list):
        widths = {len(row) for row in value}
        if len(widths) != 1:
            raise AssertionError(f"Ragged matrix widths: {sorted(widths)}")
        return len(value), widths.pop()
    return (len(value),)


class SampleShapeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.experiments = json.loads(SAMPLE_PATH.read_text(encoding="utf-8"))["experiments"]

    def test_handwritten_sample_counts(self):
        for experiment, expected in EXPECTED_SHAPES.items():
            with self.subTest(experiment=experiment):
                data = self.experiments[experiment]
                for path, expected_shape in expected.items():
                    with self.subTest(path=path):
                        self.assertEqual(shape(value_at(data, path)), expected_shape)


if __name__ == "__main__":
    unittest.main(verbosity=2)
