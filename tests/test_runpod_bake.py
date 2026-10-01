"""Offline checks for spending bounds, secret handling and untrusted downloads."""
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
