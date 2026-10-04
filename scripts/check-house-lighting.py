"""Compare matching room screenshots in linear light against the live baseline.

Usage: python3 scripts/check-house-lighting.py REFERENCE_DIR CURRENT_DIR
Files are named hallway.png, workshop.png, basement.png and attic.png. Hallway
samples unchanged architectural surfaces: the newly white trim is a reflectance
change, so including it would incorrectly count white paint as increased light.
"""
import argparse,json
from pathlib import Path
from PIL import Image

ROOMS=('hallway','workshop','basement','attic')
HALL_PATCHES=((10,200,140,600),(1130,200,1270,600),(550,210,735,250),(580,520,690,595))
LINEAR=[v/255/12.92 if v<=10 else ((v/255+.055)/1.055)**2.4 for v in range(256)]

def luminance(image,patches=None):
    image=image.convert('RGB');parts=[image.crop(p) for p in patches] if patches else [image]
    total=count=0
    for part in parts:
        for r,g,b in part.getdata():total+=.2126*LINEAR[r]+.7152*LINEAR[g]+.0722*LINEAR[b];count+=1
    return total/count

def compare(reference,current,threshold=.05):
    results={}
    for room in ROOMS:
        a=Image.open(Path(reference)/(room+'.png'));b=Image.open(Path(current)/(room+'.png'))
        if a.size!=b.size or a.size!=(1280,720):raise ValueError('Capture matching 1280 × 720 endpoint views')
        patches=HALL_PATCHES if room=='hallway' else None
        baseline=luminance(a,patches);value=luminance(b,patches);delta=value/baseline-1
        result={'liveLuminance':baseline,'currentLuminance':value,'differencePercent':round(delta*100,3),'pass':abs(delta)<=threshold,'measurement':'unchanged walls and ceiling' if patches else 'matching endpoint view'}
        if patches:
            result['patches']=[]
            for name,patch in zip(('left wall','right wall','ceiling','under window'),patches):
                patch_delta=luminance(b,[patch])/luminance(a,[patch])-1
                result['patches'].append({'surface':name,'differencePercent':round(patch_delta*100,3),'pass':abs(patch_delta)<=threshold})
            result['pass']=all(patch['pass'] for patch in result['patches'])
        results[room]=result
    return results

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('reference');parser.add_argument('current');parser.add_argument('--report',type=Path)
    args=parser.parse_args();results=compare(args.reference,args.current)
    output=json.dumps({'metric':'mean Rec.709 luminance after sRGB linearization','thresholdPercent':5,'rooms':results},indent=2)
    print(output)
    if args.report:args.report.write_text(output+'\n')
    raise SystemExit(0 if all(r['pass'] for r in results.values()) else 1)
