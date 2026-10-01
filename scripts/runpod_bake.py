"""Run the existing house bake on an ephemeral Runpod GPU; never publish assets.

Credentials: RUNPOD_API_KEY, or ignored owner-readable .env.runpod.
Use `status` for a read-only account check; `benchmark` creates a paid pod.
"""
import argparse
import hashlib
import json
import os
import re
from pathlib import Path
import secrets
import subprocess
import sys
import tarfile
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
STATE_DIR = ROOT / '.runpod'
API = 'https://rest.runpod.io/v1'
GPU = 'NVIDIA GeForce RTX 4090'
GPUS = [GPU, 'NVIDIA GeForce RTX 5090', 'NVIDIA RTX A5000']


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def credential():
    key = os.environ.get('RUNPOD_API_KEY')
    if not key:
        path = ROOT / '.env.runpod'
        if path.exists():
            if path.stat().st_mode & 0o077:
                raise RuntimeError('.env.runpod must have permissions 600')
            for line in path.read_text().splitlines():
                if line.startswith('RUNPOD_API_KEY='):
                    key = line.split('=', 1)[1].strip()
    if not key or any(character in key for character in '\r\n"'):
        raise RuntimeError('Set RUNPOD_API_KEY or .env.runpod first')
    return key


def request(url, token, method='GET', payload=None, upload=None, download=None, headers=None, timeout=40):
    # Secrets go through curl's stdin config, not process arguments or log output.
    config = ['header = ' + json.dumps('Authorization: Bearer ' + token)]
    command = ['curl', '--silent', '--show-error', '--max-time', str(timeout),
               '--request', method, '--config', '-', '--write-out', '\n%{http_code}', url]
    for name, value in (headers or {}).items():
        config.append('header = ' + json.dumps(name + ': ' + value))
    if payload is not None:
        config.append('header = "Content-Type: application/json"')
        config.append('data = ' + json.dumps(json.dumps(payload)))
    if upload:
        command += ['--data-binary', '@' + str(upload)]
    if download:
        command += ['--output', str(download)]
    result = subprocess.run(command, input='\n'.join(config) + '\n', text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError('HTTPS request failed (curl exit %s)' % result.returncode)
    body, code = result.stdout.rsplit('\n', 1)
    if not 200 <= int(code) < 300:
        # Print only short top-level diagnostics, with tokens scrubbed. Never
        # dump responses, which may contain a submitted pod's environment.
        try:
            error_data = json.loads(body)
            detail = error_data.get('error', error_data.get('message', ''))
            if isinstance(detail, str) and len(detail) < 300:
                detail = re.sub(r'rpa_[A-Za-z0-9]+', '[redacted]', detail.replace(token, '[redacted]'))
                if not any(word in detail for word in ['BAKE_TOKEN', 'BAKE_RUNPOD_KEY', 'Authorization']):
                    print('Runpod API:', detail, file=sys.stderr)
        except (ValueError, AttributeError):
            pass
        raise RuntimeError('Runpod HTTP ' + code)
    if download or not body:
        return None
    try:
        return json.loads(body)
    except ValueError:
        return body


def graphql(key, query):
    result = request('https://api.runpod.io/graphql', key, 'POST', {'query': query})
    if result.get('errors'):
        raise RuntimeError('Runpod GraphQL request rejected')
    return result['data']


def worker_status(url, token, deadline):
    # Runpod's proxy can briefly return 404/502 even after the container is ready.
    # Only reads are retried; a paid creation request is never retried blindly.
    for attempt in range(6):
        try:
            return request(url + '/status', token, timeout=15)
        except RuntimeError:
            if attempt == 5 or time.time() + 30 >= deadline:
                raise
            time.sleep(5)


def quote(key, gpu_id=GPU):
    data = graphql(key, '{ gpuTypes { id securePrice memoryInGb lowestPrice(input: {gpuCount: 1, secureCloud: true}) { uninterruptablePrice stockStatus } } myself { clientBalance } }')
    gpu = next(gpu for gpu in data['gpuTypes'] if gpu['id'] == gpu_id)
    return {'gpu': gpu_id, 'gpuHourly': float(gpu['securePrice']),
            'vramGB': gpu['memoryInGb'], 'availability': gpu.get('lowestPrice'),
            'credit': data['myself']['clientBalance']}


def limits(hourly, max_hourly, budget, minutes):
    if not all(0 < value < float('inf') for value in [hourly, max_hourly, budget, minutes]):
        raise ValueError('Prices, budget and runtime must be finite positive numbers')
    if hourly > max_hourly:
        raise ValueError('Quoted cost exceeds the hourly limit')
    # Reserve 10% for cleanup/API delays. This is not a provider spending cap.
    seconds = min(minutes * 60, budget * 0.9 / hourly * 3600)
    if seconds < 300:
        raise ValueError('Budget/runtime too small for provisioning and cleanup')
    return int(seconds)


def pack(destination):
    files = [ROOT / 'scene/house-release.blend', ROOT / 'scene/basement-refit.json',
             ROOT / 'scene/exports/house-release/classification.json',
             ROOT / 'scene/exports/house/basement.glb']
    files += sorted((ROOT / 'scene/scripts').glob('*.py'))
    for directory in ['scene/exports/house-release/bake-input', 'scene/house-textures', 'scene/textures']:
        files += sorted(path for path in (ROOT / directory).rglob('*') if path.is_file() and not path.name.startswith('.'))
    required = ['structure.glb', 'basement.glb', 'attic.glb', 'layout.json']
    for name in required:
        if not (ROOT / 'scene/exports/house-release/bake-input' / name).is_file():
            raise RuntimeError('Missing bake input: ' + name)
    for path in files:
        if not path.is_file() or path.is_symlink():
            raise RuntimeError('Missing or symlinked input: ' + str(path.relative_to(ROOT)))
    with tarfile.open(destination, 'w:gz') as archive:
        for path in files:
            archive.add(path, arcname=str(path.relative_to(ROOT)), recursive=False)
    return {str(path.relative_to(ROOT)): sha256(path) for path in files}


def unpack_result(bundle, destination):
    destination.mkdir()
    with tarfile.open(bundle) as archive:
        members = archive.getmembers()
        if sum(member.size for member in members) > 2_000_000_000:
            raise ValueError('Oversized result')
        for member in members:
            if not member.isfile() or Path(member.name).name != member.name or member.name in ('.', '..'):
                raise ValueError('Unsafe result path')
        archive.extractall(destination, members=members, filter='data')
    for name in ['bake-report.json', 'cloud-report.json', 'structure-lighting.glb',
                 'basement-lighting.glb', 'attic-lighting.glb']:
        if not (destination / name).is_file():
            raise ValueError('Incomplete bake: missing ' + name)


def safe_pod(pod):
    return {field: pod.get(field) for field in ['id', 'name', 'desiredStatus', 'costPerHr', 'adjustedCostPerHr']}


def delete(key, pod_id):
    for attempt in range(3):
        try:
            request(API + '/pods/' + pod_id, key, 'DELETE')
            break
        except RuntimeError as error:
            if str(error) == 'Runpod HTTP 404':
                break
            if attempt == 2:
                raise
            time.sleep(3)
    pods = request(API + '/pods', key)
    if any(pod['id'] == pod_id and pod.get('desiredStatus') != 'TERMINATED' for pod in pods):
        raise RuntimeError('Deletion not yet confirmed for pod ' + pod_id)


def benchmark(args, key):
    STATE_DIR.mkdir(mode=0o700, exist_ok=True)
    # Do not accidentally stack paid jobs after a prior interrupted invocation.
    pods = request(API + '/pods', key)
    if any(pod.get('name', '').startswith('jiggmin-bake-') for pod in pods):
        raise RuntimeError('An existing jiggmin bake pod needs cleanup; run status first')
    pricing = quote(key, args.gpu)
    if not (pricing.get('availability') or {}).get('uninterruptablePrice'):
        raise RuntimeError('Selected Secure Cloud GPU currently unavailable; choose another GPU explicitly')
    # 40 GB container disk at $0.10/GB/month, rounded upward for the estimate.
    estimated_hourly = pricing['gpuHourly'] + 0.01
    duration = limits(estimated_hourly, args.max_hourly, args.budget, args.max_minutes)
    if pricing['credit'] < min(args.budget, estimated_hourly):
        raise RuntimeError('Insufficient Runpod account credit')
    run_id = time.strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:6]
    run_dir = STATE_DIR / run_id
    run_dir.mkdir(mode=0o700)
    print('Packing scene and textures...', flush=True)
    manifest = pack(run_dir / 'input.tar.gz')
    (run_dir / 'input-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'gpu': args.gpu, 'estimatedHourlyIncludingDisk': estimated_hourly,
                      'budget': args.budget, 'maximumMinutes': duration / 60,
                      'uploadMB': round((run_dir / 'input.tar.gz').stat().st_size / 1e6, 1)}), flush=True)
    started = time.time()
    deadline = started + duration
    name = 'jiggmin-bake-' + run_id
    token = secrets.token_urlsafe(32)
    state = {'name': name, 'runId': run_id, 'started': started, 'deadline': deadline,
             'estimatedHourly': estimated_hourly, 'quality': args.quality,
             'budget': args.budget, 'podId': None, 'deleted': False}
    state_path = run_dir / 'state.json'

    def save():
        state_path.write_text(json.dumps(state, indent=2) + '\n')

    save()
    try:
        pod = request(API + '/pods', key, 'POST', {
            'name': name, 'cloudType': 'SECURE', 'computeType': 'GPU',
            'gpuTypeIds': [args.gpu], 'gpuCount': 1, 'interruptible': False,
            'minRAMPerGPU': 24, 'minVCPUPerGPU': 4,
            'containerDiskInGb': 40, 'volumeInGb': 0,
            'imageName': 'python:3.11-slim-bookworm',
            'ports': ['8888/http'],
            'dockerEntrypoint': ['python3', '-u', '-c'],
            'dockerStartCmd': [(ROOT / 'scripts/runpod_worker.py').read_text()],
            'env': {'BAKE_TOKEN': token, 'BAKE_RUNPOD_KEY': key,
                    'BAKE_DEADLINE': str(deadline), 'BAKE_QUALITY': args.quality,
                    'NVIDIA_DRIVER_CAPABILITIES': 'compute,utility,graphics',
                    'NVIDIA_VISIBLE_DEVICES': 'all'},
        }, timeout=60)
        state['podId'] = pod['id']
        save()
        rates = [float(pod[field]) for field in ['costPerHr', 'adjustedCostPerHr'] if pod.get(field) is not None]
        if not rates or max(rates) + 0.01 > args.max_hourly:
            raise RuntimeError('Actual pod price missing or exceeds hourly limit')
        state['actualHourly'] = max(rates)
        save()
        print('Pod allocated:', pod['id'], 'at $' + str(max(rates)) + '/hour (plus disk)', flush=True)
        url = 'https://' + pod['id'] + '-8888.proxy.runpod.net'
        last_phase = None
        while True:
            if time.time() > min(deadline - 120, started + 600):
                raise RuntimeError('Pod startup timed out; cleaning up')
            try:
                health = request(url + '/status', token, timeout=20)
                if isinstance(health, dict) and health.get('phase') == 'ready':
                    if health.get('watchdogPodId') != pod['id'] or health.get('watchdogDeadline') != deadline:
                        raise RuntimeError('Watchdog configuration mismatch')
                    break
            except RuntimeError:
                pass
            time.sleep(10)
        print('Worker ready; uploading scene...', flush=True)
        try:
            request(url + '/input', token, 'POST', upload=run_dir / 'input.tar.gz',
                    headers={'X-Content-SHA256': sha256(run_dir / 'input.tar.gz')}, timeout=180)
        except RuntimeError:
            health = worker_status(url, token, deadline)
            if health.get('phase') == 'ready':
                # The worker never received it. Its phase guard rejects duplicate jobs.
                request(url + '/input', token, 'POST', upload=run_dir / 'input.tar.gz',
                        headers={'X-Content-SHA256': sha256(run_dir / 'input.tar.gz')}, timeout=180)
            elif health.get('phase') not in ['uploading', 'installing', 'baking', 'complete', 'failed']:
                raise
        while True:
            if time.time() > deadline - 120:
                raise RuntimeError('Runtime limit reached; cleaning up')
            health = worker_status(url, token, deadline)
            phase = health['phase']
            if phase != last_phase:
                print('Cloud bake:', phase, flush=True)
                last_phase = phase
            if phase in ['complete', 'failed']:
                logs = request(url + '/logs', token)
                (run_dir / 'worker.log').write_text(logs if isinstance(logs, str) else json.dumps(logs))
                if phase == 'failed':
                    raise RuntimeError('Cloud bake failed: ' + health.get('error', 'see worker.log'))
                break
            time.sleep(10)
        request(url + '/result', token, download=run_dir / 'result.tar.gz', timeout=180)
        if sha256(run_dir / 'result.tar.gz') != health['sha256']:
            raise RuntimeError('Downloaded result checksum mismatch')
        unpack_result(run_dir / 'result.tar.gz', run_dir / 'output')
        state['report'] = health['report']
        print('Verified output:', run_dir / 'output', flush=True)
        print(json.dumps(health['report']), flush=True)
    finally:
        # Creation is deliberately never retried. Reconcile ambiguous outcomes by
        # this invocation's unique name so a response timeout cannot orphan a pod.
        if not state['podId']:
            matches = [pod for pod in request(API + '/pods', key) if pod.get('name') == name]
            if len(matches) == 1:
                state['podId'] = matches[0]['id']
                save()
        if state['podId']:
            delete(key, state['podId'])
            state['deleted'] = True
            state['finished'] = time.time()
            state['estimatedCost'] = round((state['finished'] - started) / 3600 * (state.get('actualHourly', pricing['gpuHourly']) + 0.01), 4)
            print('Pod deletion confirmed. Estimated total: $' + str(state['estimatedCost']), flush=True)
        save()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('status')
    sub.add_parser('quote')
    progress = sub.add_parser('progress')
    progress.add_argument('pod_id')
    bake = sub.add_parser('benchmark')
    bake.add_argument('--gpu', choices=GPUS, default=GPU)
    bake.add_argument('--quality', choices=['test', 'final'], default='test')
    bake.add_argument('--budget', type=float, default=2)
    bake.add_argument('--max-hourly', type=float, default=1)
    bake.add_argument('--max-minutes', type=float, default=60)
    remove = sub.add_parser('delete')
    remove.add_argument('pod_id')
    args = parser.parse_args()
    key = credential()
    if args.command == 'status':
        print(json.dumps([safe_pod(pod) for pod in request(API + '/pods', key)], indent=2))
    elif args.command == 'quote':
        print(json.dumps(quote(key), indent=2))
    elif args.command == 'progress':
        pod = request(API + '/pods/' + args.pod_id, key)
        if not pod.get('name', '').startswith('jiggmin-bake-'):
            raise RuntimeError('Not a project bake pod')
        token = pod.get('env', {}).get('BAKE_TOKEN')
        if not token:
            raise RuntimeError('Worker token unavailable')
        url = 'https://' + args.pod_id + '-8888.proxy.runpod.net'
        print(json.dumps(request(url + '/status', token), indent=2))
        logs = request(url + '/logs', token)
        if isinstance(logs, str):
            print(logs[-4000:])
    elif args.command == 'delete':
        pods = request(API + '/pods', key)
        pod = next((pod for pod in pods if pod['id'] == args.pod_id), None)
        if not pod or not pod.get('name', '').startswith('jiggmin-bake-'):
            raise RuntimeError('Refusing to delete a pod outside this project')
        delete(key, args.pod_id)
        print('Pod deletion confirmed.')
    else:
        benchmark(args, key)


if __name__ == '__main__':
    try:
        main()
    except (Exception, KeyboardInterrupt) as error:
        print('Runpod bake:', str(error) or 'interrupted', file=sys.stderr)
        sys.exit(1)
