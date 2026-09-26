#!/usr/bin/env python3
"""Fetch the main SWFs explicitly advertised by the downloaded PR2/PR3 loaders."""
import json,pathlib,hashlib,concurrent.futures
from urllib.parse import urlparse
from fetch_ruffle_games import fetch,validate_swf,ROOT
path=ROOT/'data/games.json';manifest=json.loads(path.read_text())
SOURCES={'platform-racing-2':('https://pr2hub.com/version.txt','json'),'platform-racing-3':('https://pr3hub.com/swf_info.txt?','text')}
def one(entry):
 slug=entry['id']
 if slug not in SOURCES:return
 descriptor,kind=SOURCES[slug];raw,final=fetch(descriptor);info=json.loads(raw) if kind=='json' else raw.decode().strip()
 source=info['url'] if kind=='json' else info
 if source.startswith('//'):source='https:'+source
 parsed=urlparse(source)
 if parsed.scheme!='https' or parsed.hostname not in ['pr2hub.com','pr3hub.com'] or not parsed.path.endswith('.swf'):raise ValueError('Unexpected main SWF URL')
 data,url=fetch(source)
 try:meta=validate_swf(data)
 except ValueError as error:meta={'validation':'not a standard standalone SWF','reason':str(error),'firstEightBytesHex':data[:8].hex()}
 folder=ROOT/'games'/slug;target=folder/pathlib.PurePosixPath(parsed.path).name;target.write_bytes(data)
 descriptor_target=folder/('version.json' if kind=='json' else 'swf-info.txt');descriptor_target.write_bytes(raw)
 entry['mainPayload']={'source':url,'file':str(target.relative_to(ROOT)),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'swf':meta,'descriptorSource':final,'descriptorFile':str(descriptor_target.relative_to(ROOT))}
 entry['offlineCompleteness']='Main payload and loader fetched; online services and other runtime assets not mirrored.'
 print(entry['title'],len(data),'main payload bytes',flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(one,manifest['games']))
manifest['excluded']=[{'title':'Bubble Racing (WIP)','sourcePage':'https://bubbleracing.com/','reason':'Separate non-Ruffle web game; excluded from this fetch.'},{'title':'Volly-Bounce','sourcePage':'https://vb.jiggmin2.com/','reason':'Separate non-Ruffle web game; excluded from this fetch.'}]
path.write_text(json.dumps(manifest,indent=2)+'\n')
