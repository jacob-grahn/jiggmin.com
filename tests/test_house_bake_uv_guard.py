import sys
import unittest
from pathlib import Path
from types import SimpleNamespace as NS
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scene/scripts'))
from house_bake_uv_guard import validate_receivers, material_uses_uv


class Inputs(list):
    def __getitem__(self, key):
        return next(s for s in self if s.name == key) if isinstance(key, str) else super().__getitem__(key)


class Node:
    def __init__(self, kind, inputs=()):
        self.type = kind
        self.inputs = Inputs(NS(name=name, links=[], is_linked=False) for name in inputs)


def connect(source, target, socket, output='Color'):
    target.inputs[socket].links.append(NS(from_node=source, from_socket=NS(name=output)))
    target.inputs[socket].is_linked = True


class BakeUVGuardTest(unittest.TestCase):
    def receiver(self, **changes):
        # Values within 0..1 are equally plausible for reflectance or lighting:
        # coordinate values alone cannot establish their provenance.
        record = dict(name='Generic trim', uses_uv=True, provenance='restored',
                      faces=[[(0, 0), (1, 0), (1, 1), (0, 1)]])
        return {**record, **changes}

    def test_reused_lighting_coordinates_fail_even_with_valid_uv_area(self):
        with self.assertRaisesRegex(RuntimeError, 'Generic trim.*not restored'):
            validate_receivers([self.receiver(provenance=None)])

    def test_restored_and_authored_uvs_pass_including_tiling(self):
        validate_receivers([self.receiver(), self.receiver(provenance='authored',
                           faces=[[(-2, 0), (3, 0), (3, 4)]])])

    def test_missing_and_collapsed_coordinates_fail(self):
        for faces, reason in [([], 'missing'), ([[(0, 0)] * 3], 'collapsed'),
                              ([[(0, 0), (1, 0), (2, 0)]], 'collapsed')]:
            with self.subTest(reason=reason), self.assertRaisesRegex(RuntimeError, reason):
                validate_receivers([self.receiver(faces=faces)])

    def test_non_finite_coordinates_fail(self):
        with self.assertRaisesRegex(RuntimeError, 'non-finite'):
            validate_receivers([self.receiver(faces=[[(0, 0), (1, 0), (float('nan'), 1)]])])

    def test_untextured_surfaces_do_not_require_uvs(self):
        validate_receivers([self.receiver(uses_uv=False, provenance=None, faces=[])])

    def material(self, vector=None, orphan=False):
        image = Node('TEX_IMAGE', ['Vector'])
        shader = Node('BSDF_PRINCIPLED', ['Base Color'])
        output = Node('OUTPUT_MATERIAL', ['Surface'])
        connect(shader, output, 'Surface')
        if not orphan:
            connect(image, shader, 'Base Color')
        nodes = [image, shader, output]
        if vector:
            coord = Node('TEX_COORD')
            mapping = Node('MAPPING', ['Vector'])
            connect(coord, mapping, 'Vector', vector)
            connect(mapping, image, 'Vector', 'Vector')
            nodes += [coord, mapping]
        return NS(use_nodes=True, node_tree=NS(nodes=nodes))

    def test_implicit_and_explicit_uv_images_require_validation(self):
        self.assertTrue(material_uses_uv(self.material()))
        self.assertTrue(material_uses_uv(self.material('UV')))

    def test_generated_coordinates_and_unused_images_are_exempt(self):
        self.assertFalse(material_uses_uv(self.material('Generated')))
        self.assertFalse(material_uses_uv(self.material(orphan=True)))


if __name__ == '__main__':
    unittest.main()
