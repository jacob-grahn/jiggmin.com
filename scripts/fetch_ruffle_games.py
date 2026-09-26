#!/usr/bin/env python3
"""Fetch only Ruffle-embedded entries linked by jiggmin2.com's game index.
Uses curl for the macOS system certificate store. Never executes downloaded SWFs.
"""
import concurrent.futures,datetime,hashlib,html,json,pathlib,re,struct,subprocess,zlib
from html.parser import HTMLParser
from urllib.parse import urljoin,urlparse
ROOT=pathlib.Path(__file__).resolve().parents[1];BASE='https://jiggmin2.com/'

def fetch(url):
 result=subprocess.run(['curl','--fail','--silent','--show-error','--location','--max-time','90','--retry','2','--write-out','\n%{url_effective}',url],capture_output=True,check=True)
 body,final=result.stdout.rsplit(b'\n',1)
 return body,final.decode()

class Page(HTMLParser):
 def __init__(self):
  super().__init__();self.objects=[];self.embeds=[];self.params=[];self.scripts=[];self.title='';self.in_title=False
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='object':self.objects.append(a)
  elif tag=='embed':self.embeds.append(a)
  elif tag=='param':self.params.append(a)
  elif tag=='script':self.scripts.append(a.get('src',''))
  elif tag=='title':self.in_title=True
 def handle_endtag(self,tag):
  if tag=='title':self.in_title=False
 def handle_data(self,data):
  if self.in_title:self.title+=data

def strip(s):return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]*>',' ',s))).strip()

def validate_swf(data):
 if len(data)<12 or data[:3] not in (b'FWS',b'CWS',b'ZWS'):raise ValueError('Download is not a SWF')
 declared=struct.unpack('<I',data[4:8])[0]
 if data[:3]==b'CWS':body=zlib.decompress(data[8:])
 elif data[:3]==b'FWS':body=data[8:]
 else:raise ValueError('LZMA SWF needs a separate validation path')
 if len(body)+8!=declared:raise ValueError(f'SWF uncompressed length mismatch: {len(body)+8} != {declared}')
 bits=''.join(f'{v:08b}' for v in body[:20]);nb=int(bits[:5],2);vals=[];pos=5
 for _ in range(4):
  v=int(bits[pos:pos+nb],2);vals.append(v-(1<<nb) if v&(1<<(nb-1)) else v);pos+=nb
 offset=(pos+7)//8
 result={'signature':data[:3].decode(),'version':data[3],'uncompressedBytes':declared,'stageWidth':(vals[1]-vals[0])/20,'stageHeight':(vals[3]-vals[2])/20,'frameRate':struct.unpack('<H',body[offset:offset+2])[0]/256}
 # Static hints, not a claim that all network dependencies have been found.
 urls=sorted(set(s.decode('ascii',errors='replace') for s in re.findall(rb'https?://[\x21-\x7e]{4,250}',body)))
 result['embeddedUrlHints']=urls
 return result

def main():
 data,_=fetch(BASE);source=data.decode('utf-8',errors='replace')
 matches=re.findall(r'<a\s+href="((?:/)?games/[^"]+)">([^<]+)</a>',source)
 entries={urljoin(BASE,path):html.unescape(title) for path,title in matches}
 external=[]
 for href,title in re.findall(r'<a\s+href="(https?://[^"]+)"[^>]*>([^<]+)</a>',source):
  if 'bubbleracing.com' in href or 'vb.jiggmin2.com' in href:external.append({'title':html.unescape(title),'sourcePage':href,'reason':'Separate non-Ruffle web game; excluded from this fetch.'})
 dest=ROOT/'games';dest.mkdir(exist_ok=True);(ROOT/'data').mkdir(exist_ok=True)
 def one(item):
  page_url,title=item;raw,effective=fetch(page_url);text=raw.decode('utf-8',errors='replace');p=Page();p.feed(text)
  candidates=[a for a in p.objects if '.swf' in a.get('data','').lower()]+[a for a in p.embeds if '.swf' in a.get('src','').lower()]
  notice=re.search(r'<!-- start: games_ruffle_notice -->(.*?)<!-- end: games_ruffle_notice -->',text,re.S)
  if not candidates or not any('ruffle' in s.lower() for s in p.scripts):return {'excluded':{'title':title,'sourcePage':page_url,'reason':'No Ruffle SWF embed found.'}}
  a=candidates[0];swf=urljoin(effective,a.get('data',a.get('src','')));slug=urlparse(page_url).path.rstrip('/').split('/')[-1]
  folder=dest/slug;folder.mkdir(exist_ok=True)
  body,final=fetch(swf);meta=validate_swf(body);name=pathlib.PurePosixPath(urlparse(final).path).name
  (folder/name).write_bytes(body)
  thumb_matches=re.findall(r'<img[^>]+src="([^"]+)"[^>]+alt="'+re.escape(title)+r'"',source,re.I)
  thumb=thumb_matches[0] if thumb_matches else None
  item={'id':slug,'title':title,'sourcePage':page_url,'resolvedPage':effective,'sourceSwf':swf,'resolvedSwf':final,'file':str((folder/name).relative_to(ROOT)),'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest(),'embedWidth':int(a['width']),'embedHeight':int(a['height']),'sourceRuffleNotice':strip(notice.group(1)) if notice else None,'sourceCompatibilityWarning':bool(notice and 'may not function properly' in notice.group(1)),'entryPointKind':'loader' if 'loader' in name.lower() else 'game','playbackTested':False,'offlineCompleteness':'not verified','swf':meta}
  if thumb:
   img,img_final=fetch(urljoin(BASE,thumb))
   if not (img.startswith(b'\xff\xd8\xff') or img.startswith(b'\x89PNG\r\n\x1a\n')):raise ValueError('Thumbnail is not JPEG/PNG')
   ext='.jpg' if img.startswith(b'\xff\xd8') else '.png';path=folder/('thumbnail'+ext);path.write_bytes(img);item['thumbnail']={'file':str(path.relative_to(ROOT)),'source':img_final,'bytes':len(img),'sha256':hashlib.sha256(img).hexdigest()}
  params={v.get('name',''):v.get('value','') for v in p.params if v.get('name','').lower() not in ['movie']}
  item['embedParameters']=params
  print(f"Fetched {title}: {len(body):,} bytes ({item['entryPointKind']})",flush=True)
  return item
 results=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  for item in pool.map(one,entries.items()):results.append(item)
 games=[x for x in results if 'excluded' not in x]
 manifest={'sourceIndex':BASE,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'selectionRule':'Game page links from the index that contain both a Ruffle script and an actual SWF object/embed. Includes warning-marked Ruffle entries; excludes header animations and separate non-Ruffle games.','games':games,'excluded':external+[x['excluded'] for x in results if 'excluded' in x]}
 (ROOT/'data/games.json').write_text(json.dumps(manifest,indent=2)+'\n')
 print(json.dumps({'games':len(games),'swfBytes':sum(x['bytes'] for x in games),'warnings':sum(x['sourceCompatibilityWarning'] for x in games),'loaders':[x['title'] for x in games if x['entryPointKind']=='loader'],'excluded':manifest['excluded']},indent=2))
if __name__=='__main__':main()
