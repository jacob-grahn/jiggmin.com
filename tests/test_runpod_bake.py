"""Offline checks for spending bounds, secret handling and untrusted downloads."""
import argparse
from contextlib import ExitStack, redirect_stdout
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tarfile
import tempfile
import time
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('runpod_bake', Path(__file__).resolve().parents[1] / 'scripts/runpod_bake.py')
cloud = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cloud)


class RunpodTests(unittest.TestCase):
    def auto_args(self, **overrides):
        values = dict(gpu=None, gpus=cloud.FALLBACK_GPUS, budget=.5,
                      max_hourly=1, max_minutes=30, target='den', quality='test')
        values.update(overrides)
        return argparse.Namespace(**values)

    def test_fallback_order_and_success_stops_further_attempts(self):
        args = self.auto_args()
        with patch.object(cloud, 'benchmark', side_effect=[cloud.GPUUnavailable('no capacity'), 'done']) as bake, redirect_stdout(io.StringIO()):
            self.assertEqual(cloud.automatic(args, 'key'), 'done')
        self.assertEqual([c.args[0].gpu for c in bake.call_args_list], cloud.FALLBACK_GPUS[:2])
        self.assertIsNone(args.gpu)
        self.assertTrue(all(c.args[0].budget == .5 for c in bake.call_args_list))

    def test_custom_order_deduplicates_and_skips_ineligible_price(self):
        gpus = [cloud.GPUS[1], cloud.GPUS[1], cloud.GPUS[2]]
        with patch.object(cloud, 'benchmark', side_effect=[cloud.GPUIneligible('over hourly limit'), 'done']) as bake, redirect_stdout(io.StringIO()):
            cloud.automatic(self.auto_args(gpus=gpus), 'key')
        self.assertEqual([c.args[0].gpu for c in bake.call_args_list], [gpus[0], gpus[2]])

    def test_pinned_gpu_disables_fallback(self):
        with patch.object(cloud, 'benchmark', side_effect=cloud.GPUUnavailable('no capacity')) as bake, redirect_stdout(io.StringIO()):
            with self.assertRaisesRegex(RuntimeError, 'No GPU could be allocated'):
                cloud.automatic(self.auto_args(gpu=cloud.GPU), 'key')
        self.assertEqual(bake.call_count, 1)

    def test_all_candidates_exhausted_reports_each_gpu(self):
        with patch.object(cloud, 'benchmark', side_effect=cloud.GPUUnavailable('no capacity')) as bake, redirect_stdout(io.StringIO()):
            with self.assertRaises(RuntimeError) as error:
                cloud.automatic(self.auto_args(), 'key')
        self.assertEqual(bake.call_count, len(cloud.FALLBACK_GPUS))
        for gpu in cloud.FALLBACK_GPUS:
            self.assertIn(gpu, str(error.exception))

    def test_ambiguous_auth_and_bake_errors_never_trigger_fallback(self):
        for message in ['HTTPS request failed (curl exit 28)', 'Runpod HTTP 401',
                        'Cloud bake failed', 'Deletion not yet confirmed']:
            with patch.object(cloud, 'benchmark', side_effect=RuntimeError(message)) as bake, redirect_stdout(io.StringIO()):
                with self.assertRaisesRegex(RuntimeError, message.replace('(', r'\(').replace(')', r'\)')):
                    cloud.automatic(self.auto_args(), 'key')
            self.assertEqual(bake.call_count, 1)

    def test_invalid_limits_do_not_start_attempts(self):
        for overrides in [dict(budget=0), dict(budget=float('nan')), dict(max_minutes=-1)]:
            with patch.object(cloud, 'benchmark') as bake:
                with self.assertRaises(ValueError):
                    cloud.automatic(self.auto_args(**overrides), 'key')
                bake.assert_not_called()

    def test_capacity_error_classification_is_narrow(self):
        detail = json.dumps({'error': 'create pod: There are no instances currently available'})
        for method, url, code, expected in [
            ('POST', cloud.API + '/pods', '500', cloud.GPUUnavailable),
            ('POST', cloud.API + '/pods', '401', RuntimeError),
            ('GET', cloud.API + '/pods', '500', RuntimeError),
            ('POST', 'https://worker/input', '500', RuntimeError),
        ]:
            response = subprocess.CompletedProcess([], 0, detail + '\n' + code, '')
            with patch.object(cloud.subprocess, 'run', return_value=response):
                with self.assertRaises(expected) as error:
                    cloud.request(url, 'key', method)
                self.assertIs(type(error.exception), expected)
        response = subprocess.CompletedProcess([], 0, '{"error":"Internal server error"}\n500', '')
        with patch.object(cloud.subprocess, 'run', return_value=response):
            with self.assertRaises(RuntimeError) as error:
                cloud.request(cloud.API + '/pods', 'key', 'POST')
            self.assertIs(type(error.exception), RuntimeError)

    def allocation_context(self, stack, root, request):
        (root / 'scripts').mkdir()
        (root / 'scripts/runpod_worker.py').write_text('# test worker')
        stack.enter_context(patch.object(cloud, 'ROOT', root))
        stack.enter_context(patch.object(cloud, 'STATE_DIR', root / 'runs'))
        stack.enter_context(patch.object(cloud, 'request', side_effect=request))
        stack.enter_context(patch.object(cloud, 'quote', return_value={
            'gpuHourly': .27, 'availability': {'uninterruptablePrice': .27}, 'credit': 10}))
        def pack(path, target):
            path.write_bytes(b'fixture')
            return {}
        stack.enter_context(patch.object(cloud, 'pack', side_effect=pack))
        stack.enter_context(redirect_stdout(io.StringIO()))

    def test_capacity_race_reconciles_before_allowing_fallback(self):
        calls = []
        def request(url, key, method='GET', payload=None, **kwargs):
            calls.append(method)
            if method == 'POST':
                raise cloud.GPUUnavailable('capacity gone')
            return []
        with tempfile.TemporaryDirectory() as directory, ExitStack() as stack:
            self.allocation_context(stack, Path(directory), request)
            with self.assertRaises(cloud.GPUUnavailable):
                cloud.benchmark(self.auto_args(gpu=cloud.GPU), 'key')
        self.assertEqual(calls, ['GET', 'POST', 'GET'])

    def test_reconciled_pod_is_deleted_and_prevents_fallback(self):
        calls = [];name = None
        def request(url, key, method='GET', payload=None, **kwargs):
            nonlocal name
            calls.append(method)
            if method == 'POST':
                name = payload['name']
                raise cloud.GPUUnavailable('capacity gone')
            return [{'id': 'allocated', 'name': name}] if name else []
        with tempfile.TemporaryDirectory() as directory, ExitStack() as stack:
            self.allocation_context(stack, Path(directory), request)
            delete = stack.enter_context(patch.object(cloud, 'delete'))
            with self.assertRaisesRegex(RuntimeError, 'pod existed despite capacity rejection') as error:
                cloud.benchmark(self.auto_args(gpu=cloud.GPU), 'key')
            self.assertIs(type(error.exception), RuntimeError)
            delete.assert_called_once_with('key', 'allocated')
        self.assertEqual(calls, ['GET', 'POST', 'GET'])

    def test_reconciliation_failure_prevents_fallback(self):
        with tempfile.TemporaryDirectory() as directory, ExitStack() as stack:
            self.allocation_context(stack, Path(directory), [[], cloud.GPUUnavailable('gone'), RuntimeError('cannot list pods')])
            with self.assertRaisesRegex(RuntimeError, 'cannot list pods') as error:
                cloud.benchmark(self.auto_args(gpu=cloud.GPU), 'key')
            self.assertIs(type(error.exception), RuntimeError)

    def test_unavailable_quote_never_creates_a_pod(self):
        with tempfile.TemporaryDirectory() as directory, ExitStack() as stack:
            self.allocation_context(stack, Path(directory), [[]])
            stack.enter_context(patch.object(cloud, 'quote', return_value={
                'gpuHourly': .27, 'availability': None, 'credit': 10}))
            with self.assertRaises(cloud.GPUUnavailable):
                cloud.benchmark(self.auto_args(gpu=cloud.GPU), 'key')
            self.assertEqual(cloud.request.call_count, 1)

    def test_over_limit_quote_never_creates_a_pod(self):
        with tempfile.TemporaryDirectory() as directory, ExitStack() as stack:
            self.allocation_context(stack, Path(directory), [[]])
            with self.assertRaises(cloud.GPUIneligible):
                cloud.benchmark(self.auto_args(gpu=cloud.GPU, max_hourly=.2), 'key')
            self.assertEqual(cloud.request.call_count, 1)

    def test_actual_price_increase_or_invalid_price_cleans_up_and_stops(self):
        for price in [.4, float('nan'), 0]:
            with tempfile.TemporaryDirectory() as directory, ExitStack() as stack:
                self.allocation_context(stack, Path(directory), [[], {'id': 'allocated', 'costPerHr': price}])
                delete = stack.enter_context(patch.object(cloud, 'delete'))
                with self.assertRaisesRegex(RuntimeError, 'Actual pod price') as error:
                    cloud.benchmark(self.auto_args(gpu=cloud.GPU), 'key')
                self.assertIs(type(error.exception), RuntimeError)
                delete.assert_called_once_with('key', 'allocated')

    def test_cost_limits_reserve_cleanup_margin(self):
        self.assertEqual(cloud.limits(.75, 1, 2, 60), 3600)
        self.assertEqual(cloud.limits(.75, 1, .5, 60), 2160)
        for value in [0, -1, float('nan'), float('inf')]:
            with self.assertRaises(ValueError):
                cloud.limits(.75, 1, value, 60)
        with self.assertRaises(ValueError):
            cloud.limits(1.1, 1, 2, 60)

    def test_secret_is_not_in_process_arguments(self):
        with patch.object(cloud.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, '[]\n200', '')) as run:
            self.assertEqual(cloud.request(cloud.API + '/pods', 'private-token'), [])
            self.assertNotIn('private-token', repr(run.call_args.args))
            self.assertIn('private-token', run.call_args.kwargs['input'])

    def test_api_error_does_not_echo_sensitive_response(self):
        with patch.object(cloud.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, 'secret-value\n401', '')):
            with self.assertRaisesRegex(RuntimeError, '^Runpod HTTP 401$'):
                cloud.request(cloud.API + '/pods', 'private-token')

    def test_deletion_requires_confirmation(self):
        with patch.object(cloud, 'request', side_effect=[None, [{'id': 'mine', 'desiredStatus': 'RUNNING'}]]):
            with self.assertRaisesRegex(RuntimeError, 'Deletion not yet confirmed'):
                cloud.delete('key', 'mine')
        with patch.object(cloud, 'request', side_effect=[None, []]):
            cloud.delete('key', 'mine')

    def test_transient_proxy_failure_retries_only_status_reads(self):
        with patch.object(cloud, 'request', side_effect=[RuntimeError('Runpod HTTP 404'), {'phase': 'baking'}]) as request, patch.object(cloud.time, 'sleep'):
            self.assertEqual(cloud.worker_status('https://worker', 'token', time.time() + 300), {'phase': 'baking'})
            self.assertTrue(all(call.args == ('https://worker/status', 'token') for call in request.call_args_list))

    def test_proxy_retries_stop_at_deadline(self):
        with patch.object(cloud, 'request', side_effect=RuntimeError('Runpod HTTP 502')) as request, patch.object(cloud.time, 'sleep'):
            with self.assertRaises(RuntimeError):
                cloud.worker_status('https://worker', 'token', time.time() + 10)
            self.assertEqual(request.call_count, 1)

    def test_den_package_excludes_house_and_credentials(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ['scene/midnight-den-illustrated.blend', 'scene/scripts/bake_den.py',
                         'scene/textures/window.png', '.env.runpod', 'scene/house-release.blend']:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('fixture')
            with patch.object(cloud, 'ROOT', root):
                manifest = cloud.pack(root / 'input.tar.gz', 'den')
            self.assertEqual(set(manifest), {'scene/midnight-den-illustrated.blend',
                'scene/scripts/bake_den.py', 'scene/textures/window.png'})

    def test_hallway_style_package_and_result(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            expected = ['scene/house-release.blend', 'scene/scripts/bake_hallway_style.py',
                        'web/assets/house/release/structure.glb', 'web/assets/house/release/hallway.glb',
                        'web/assets/house/release/layout.json', 'scene/house-textures/paint.png']
            for name in expected + ['.env.runpod', 'web/assets/house/release/basement.glb']:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('fixture')
            with patch.object(cloud, 'ROOT', root):
                manifest = cloud.pack(root / 'input.tar.gz', 'hallway-style')
            self.assertEqual(set(manifest), set(expected))
            with tarfile.open(root / 'result.tar.gz', 'w:gz') as archive:
                for name in ['report.json', 'cloud-report.json', 'hallway-style.glb', 'trim.png', 'trim.exr']:
                    data = b'{"atlases":{"trim":{}}}' if name == 'report.json' else b'x'
                    member = tarfile.TarInfo(name)
                    member.size = len(data)
                    archive.addfile(member, io.BytesIO(data))
            cloud.unpack_result(root / 'result.tar.gz', root / 'output', 'hallway-style')
            self.assertTrue((root / 'output/trim.png').is_file())

    def test_full_atlas_result_requires_lossless_masters(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            names = ['report.json', 'cloud-report.json', 'house-atlases.glb', 'source-audit.json',
                     'structure-hall-walls.png', 'structure-hall-walls.exr']
            with tarfile.open(root / 'result.tar.gz', 'w:gz') as archive:
                for name in names:
                    data = b'{"atlases":{"structure-hall-walls":{}}}' if name == 'report.json' else b'x'
                    member = tarfile.TarInfo(name)
                    member.size = len(data)
                    archive.addfile(member, io.BytesIO(data))
            cloud.unpack_result(root / 'result.tar.gz', root / 'output', 'house-atlases')
            self.assertTrue((root / 'output/structure-hall-walls.png').is_file())

    def test_den_result_accepts_den_outputs_and_requires_atlas(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            names = ['report.json', 'cloud-report.json', 'den-baked.glb', 'lighting.png', 'lighting.exr']
            with tarfile.open(root / 'result.tar.gz', 'w:gz') as archive:
                for name in names:
                    member = tarfile.TarInfo(name)
                    data = b'{}' if name == 'report.json' else b'x'
                    member.size = len(data)
                    archive.addfile(member, io.BytesIO(data))
            cloud.unpack_result(root / 'result.tar.gz', root / 'output', 'den')
            self.assertEqual({p.name for p in (root / 'output').iterdir()}, set(names))
            with self.assertRaisesRegex(ValueError, 'missing bake-report.json'):
                cloud.unpack_result(root / 'result.tar.gz', root / 'house-output')

    def test_result_cannot_escape_output_directory(self):
        for malicious in ['../escaped', '/tmp/escaped', 'directory/file']:
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                with tarfile.open(root / 'result.tar.gz', 'w:gz') as archive:
                    member = tarfile.TarInfo(malicious)
                    member.size = 1
                    archive.addfile(member, io.BytesIO(b'x'))
                with self.assertRaisesRegex(ValueError, 'Unsafe result path'):
                    cloud.unpack_result(root / 'result.tar.gz', root / 'output')
                self.assertFalse((root / 'escaped').exists())


if __name__ == '__main__':
    unittest.main()
