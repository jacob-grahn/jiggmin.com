import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';

const house = JSON.parse(readFileSync('data/house-notes.json','utf8'));
const art = JSON.parse(readFileSync('web/assets/house/hotspots.json','utf8'));
const bonus = JSON.parse(readFileSync('data/bonus-games.json','utf8'));
const roomIds = ['hallway','workshop','attic','basement'];
const expectedHotspots = {
  hallway:['plate','contests','bitey','door-workshop','door-attic','door-basement','door-den','locked-door-2'],
  workshop:['tablet','working-hours','greg','crowland','inkclipse','zigzag','destroyers'],
  attic:['tricycle','longtide','questions','derron','farm','secret'],
  basement:['community','neverending','voices','d-note'],
};

function webpSize(buffer) {
  assert.equal(buffer.toString('ascii',0,4),'RIFF','room image must be WebP');
  assert.equal(buffer.toString('ascii',8,12),'WEBP','room image must be WebP');
  const kind = buffer.toString('ascii',12,16);
  if (kind === 'VP8X') {
    return {width:1+buffer.readUIntLE(24,3),height:1+buffer.readUIntLE(27,3)};
  }
  if (kind === 'VP8L') {
    assert.equal(buffer[20],0x2f,'invalid VP8L signature');
    const b1=buffer[21],b2=buffer[22],b3=buffer[23],b4=buffer[24];
    return {width:1+((b2&0x3f)<<8)+b1,height:1+((b4&0x0f)<<10)+(b3<<2)+(b2>>6)};
  }
  if (kind === 'VP8 ') {
    assert.deepEqual([...buffer.subarray(23,26)],[0x9d,0x01,0x2a],'invalid VP8 frame header');
    return {width:buffer.readUInt16LE(26)&0x3fff,height:buffer.readUInt16LE(28)&0x3fff};
  }
  assert.fail(`unsupported WebP chunk ${kind}`);
}

function checkAsset(asset, {limit,hash,bytes}={}) {
  assert.equal(typeof asset,'string');
  assert.ok(!asset.startsWith('/')&&!asset.split('/').includes('..'),`unsafe asset path: ${asset}`);
  assert.ok(existsSync(asset),`missing asset: ${asset}`);
  const file=readFileSync(asset),size=statSync(asset).size;
  if (limit) assert.ok(size<=limit,`${asset} is ${size} bytes; limit is ${limit}`);
  if (bytes !== undefined) assert.equal(size,bytes,`${asset} byte count`);
  if (hash) assert.equal(createHash('sha256').update(file).digest('hex'),hash,`${asset} SHA-256`);
}

test('house notes resolve to one room and an authored hotspot',()=>{
 assert.deepEqual(house.rooms.map(room=>room.id),roomIds);
 assert.ok(house.notes.length<=26,'keep the discovery set compact');
 const roomSet=new Set(roomIds),noteIds=new Set(),hotspots=new Map();
 for(const [room,objects] of Object.entries(art)){
  assert.ok(roomSet.has(room),`unknown art room ${room}`);
  hotspots.set(room,new Set(objects.map(object=>object.id)));
  assert.equal(hotspots.get(room).size,objects.length,`duplicate hotspot in ${room}`);
 }
 for(const id of roomIds)assert.ok(Array.isArray(art[id]),`missing ${id} hotspot list`);
 for(const note of house.notes){
  assert.ok(!noteIds.has(note.id),`duplicate note ID ${note.id}`);noteIds.add(note.id);
  assert.ok(roomSet.has(note.room),`${note.id} references unknown room ${note.room}`);
  assert.ok(hotspots.get(note.room)?.has(note.hotspot),`${note.id} references missing ${note.room}/${note.hotspot}`);
  assert.ok(typeof note.title==='string'&&typeof note.body==='string',`${note.id} needs readable copy`);
  assert.ok(['note','cartridge'].includes(note.kind),`${note.id} has unknown kind`);
  if(note.kind==='cartridge')assert.ok(typeof note.gameId==='string',`${note.id} has no game ID`);
  else assert.ok(note.gameId===undefined,`${note.id} has an unexpected game ID`);
 }
});

test('all illustrated hotspot IDs and the remaining future door have matching copy',()=>{
 for(const [room,ids] of Object.entries(expectedHotspots)){
  const actual=new Set(art[room].map(object=>object.id));
  for(const id of ids)assert.ok(actual.has(id),`missing illustrated hotspot ${room}/${id}`);
 }
 const locked=new Set(house.lockedDoors.map(door=>door.id));
 assert.deepEqual([...locked].sort(),['locked-door-2']);
 for(const door of house.lockedDoors){
  assert.ok(art.hallway.some(object=>object.id===door.id),`missing art for ${door.id}`);
  assert.match(door.body,/(?:not|isn't) available yet/i,`${door.id} should state plainly that it is unavailable`);
 }
});

test('bonus cartridges match verified metadata and packaged asset hashes',()=>{
 const catalog=new Map(bonus.games.map(game=>[game.id,game]));
 const cartridgeNotes=house.notes.filter(note=>note.kind==='cartridge');
 assert.ok(cartridgeNotes.length>0);
 for(const note of cartridgeNotes){
  assert.ok(note.gameId,`${note.id} has no game ID`);
  const game=catalog.get(note.gameId);assert.ok(game,`${note.id} points to unknown game ${note.gameId}`);
  checkAsset(game.file,{bytes:game.bytes,hash:game.sha256});
  checkAsset(game.thumbnail,{limit:1024*1024});
  if(game.original)checkAsset(game.original.file,{bytes:game.original.bytes,hash:game.original.sha256});
 }
});

test('every room image exists, fits the payload budget, and matches hotspot proportions',()=>{
 for(const room of roomIds){
  const path=`web/assets/house/${room}.webp`,buffer=readFileSync(path);
  assert.ok(statSync(path).size<=1024*1024,`${path} exceeds 1 MB`);
  const {width,height}=webpSize(buffer);
  assert.ok(width>0&&height>0&&width<=4096&&height<=4096,`${path} has invalid dimensions ${width}x${height}`);
  assert.ok(Math.abs(width/height-1.6)<0.001,`${path} aspect ratio does not match the 8:5 hotspot canvas`);
 }
});

test('hotspot rectangles stay inside the normalized artwork',()=>{
 for(const [room,objects] of Object.entries(art))for(const object of objects){
  for(const key of ['x','y','width','height'])assert.equal(typeof object[key],'number',`${room}/${object.id} ${key}`);
  assert.ok(object.x>=0&&object.y>=0&&object.width>0&&object.height>0,`${room}/${object.id} has a non-positive rectangle`);
  assert.ok(object.x+object.width<=1.001&&object.y+object.height<=1.001,`${room}/${object.id} extends beyond its room image`);
 }
});
