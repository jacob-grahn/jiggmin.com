"""Ephemeral Runpod worker. Invoked by the pod's Python container entry point.

The watchdog explicitly deletes this pod at an absolute deadline. It is a
best-effort fallback, not a provider-enforced spending cap. No API keys are logged
or inherited by Blender. The HTTP API is accessed through Runpod's HTTPS proxy.
"""
import hashlib
import hmac
import http.server
import json
import os
import subprocess
import tarfile
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

STATE = {'phase': 'initializing'}
LOCK = threading.Lock()
WORK = Path('/workspace/cloud-bake')
WORK.mkdir(parents=True, exist_ok=True)
LOG = WORK / 'worker.log'
TOKEN = os.environ.pop('BAKE_TOKEN')
KEY = os.environ.pop('BAKE_RUNPOD_KEY')
DEADLINE = float(os.environ['BAKE_DEADLINE'])
QUALITY = os.environ['BAKE_QUALITY']
TARGET = os.environ.get('BAKE_TARGET', 'house')
if TARGET not in {'house', 'den', 'hallway-style', 'house-atlases'}: raise ValueError('Unsupported bake target')
VERSION = '4.5.14'
# https://download.blender.org/release/Blender4.5/blender-4.5.14.sha256
BLENDER_SHA256 = '9ba871ff2ecd36526b77432745980b7e6664ecd0c7ca11c48849073dcfe06da3'


def status(**values):
    with LOCK:
        STATE.update(values)


def watchdog():
    while time.time() < DEADLINE:
        time.sleep(min(10, max(0, DEADLINE - time.time())))
    pod = os.environ.get('RUNPOD_POD_ID')
    if not pod:
        status(phase='failed', error='Missing RUNPOD_POD_ID for watchdog')
        return
    request = urllib.request.Request(
        'https://rest.runpod.io/v1/pods/' + pod, method='DELETE',
        headers={'Authorization': 'Bearer ' + KEY})
    while True:
        try:
            with urllib.request.urlopen(request, timeout=20):
                pass
            return
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return
        except Exception:
            pass
        time.sleep(10)


def unpack(path, destination):
    with tarfile.open(path) as archive:
        members = archive.getmembers()
        if sum(member.size for member in members) > 2_000_000_000:
            raise ValueError('Archive too large')
        for member in members:
            target = (destination / member.name).resolve()
            if not target.is_relative_to(destination.resolve()) or not (member.isfile() or member.isdir()):
                raise ValueError('Unsafe archive entry')
        archive.extractall(destination, members=members, filter='data')


def execute():
    try:
        status(phase='installing')
        with LOG.open('ab', buffering=0) as log:
            subprocess.run(['apt-get', 'update', '-qq'], stdout=log, stderr=log, check=True)
            subprocess.run(['apt-get', 'install', '-y', '-qq', '--no-install-recommends',
                            'libxrender1', 'libxi6', 'libxkbcommon0', 'libsm6',
                            'libgl1', 'libegl1', 'libgomp1'], stdout=log, stderr=log, check=True)
            filename = f'blender-{VERSION}-linux-x64.tar.xz'
            archive = WORK / filename
            for base in ['https://download.blender.org/release/Blender4.5/',
                         'https://mirrors.ocf.berkeley.edu/blender/release/Blender4.5/']:
                try:
                    download = urllib.request.Request(base + filename, headers={'User-Agent': 'Blender-cloud-bake/1.0'})
                    with urllib.request.urlopen(download, timeout=120) as response, archive.open('wb') as output:
                        while chunk := response.read(1024 * 1024):
                            output.write(chunk)
                    break
                except urllib.error.URLError:
                    continue
            if not archive.exists():
                raise RuntimeError('Blender download failed from both sources')
            with archive.open('rb') as stream:
                if hashlib.file_digest(stream, 'sha256').hexdigest() != BLENDER_SHA256:
                    raise RuntimeError('Blender download checksum mismatch')
            # Official archive includes library symlinks; data filter confines them.
            with tarfile.open(archive) as downloaded:
                downloaded.extractall(WORK, filter='data')
            blender = WORK / filename.removesuffix('.tar.xz') / 'blender'
            project = WORK / 'project'
            project.mkdir()
            unpack(WORK / 'input.tar.gz', project)
            status(phase='baking')
            scene_file = 'scene/midnight-den-illustrated.blend' if TARGET == 'den' else 'scene/house-release.blend'
            command = [str(blender), '-b', str(project / scene_file),
                       '--python-exit-code', '1', '--python', str(project / 'scene/scripts/cloud_bake.py'),
                       '--', '--test' if QUALITY == 'test' else '--release']
            subprocess.run(command, cwd=project, stdout=log, stderr=log, check=True)
            output = project / 'scene/renders/den-uv-bake' if TARGET == 'den' else project / 'scene/exports/house-release' / QUALITY
            if TARGET == 'hallway-style': output = project / 'scene/renders/hallway-style'
            if TARGET == 'house-atlases': output = project / 'scene/renders/house-atlases'
            result = WORK / 'result.tar.gz'
            with tarfile.open(result, 'w:gz', compresslevel=1) as bundle:
                for path in sorted(output.iterdir()):
                    if path.is_file():
                        bundle.add(path, arcname=path.name)
            with result.open('rb') as stream:
                digest = hashlib.file_digest(stream, 'sha256').hexdigest()
            status(phase='complete', sha256=digest, bytes=result.stat().st_size,
                   report=json.loads((output / 'cloud-report.json').read_text()))
    except Exception as error:
        # Only type and safe subprocess diagnostics; never credentials/headers.
        status(phase='failed', error=f'{type(error).__name__}: {str(error)[:500]}')


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def authenticated(self):
        if hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + TOKEN):
            return True
        self.send_error(401)
        return False

    def do_GET(self):
        if not self.authenticated():
            return
        if self.path == '/status':
            with LOCK:
                payload = json.dumps({**STATE, 'watchdogDeadline': DEADLINE,
                                      'watchdogPodId': os.environ.get('RUNPOD_POD_ID')}).encode()
        elif self.path == '/logs':
            payload = LOG.read_bytes()[-16000:] if LOG.exists() else b''
        elif self.path == '/result' and STATE.get('phase') == 'complete':
            payload = (WORK / 'result.tar.gz').read_bytes()
        else:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        if not self.authenticated():
            return
        if self.path != '/input':
            self.send_error(404)
            return
        length = int(self.headers.get('Content-Length', '0'))
        with LOCK:
            if STATE['phase'] != 'ready' or not 0 < length <= 500_000_000:
                self.send_error(409)
                return
            STATE['phase'] = 'uploading'
        digest = hashlib.sha256()
        with (WORK / 'input.tar.gz').open('wb') as output:
            remaining = length
            while remaining:
                chunk = self.rfile.read(min(1024 * 1024, remaining))
                if not chunk:
                    status(phase='failed', error='Incomplete upload')
                    self.send_error(400)
                    return
                output.write(chunk)
                digest.update(chunk)
                remaining -= len(chunk)
        if digest.hexdigest() != self.headers.get('X-Content-SHA256'):
            status(phase='failed', error='Upload checksum mismatch')
            self.send_error(400)
            return
        threading.Thread(target=execute, daemon=True).start()
        self.send_response(202)
        self.send_header('Content-Length', '0')
        self.end_headers()


if __name__ == '__main__':
    threading.Thread(target=watchdog, daemon=True).start()
    status(phase='ready')
    http.server.ThreadingHTTPServer(('0.0.0.0', 8888), Handler).serve_forever()
