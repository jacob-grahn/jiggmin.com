import * as THREE from 'three';

// Keep the low attic joists above the hall ceiling and the sloped stair
// enclosure behind its doorway, including while both rooms are loaded.
export function roomBoundaryPlanes(id){
 if(id==='attic')return [new THREE.Plane(new THREE.Vector3(0,1,0),-3.14)];
 if(id==='basement')return [new THREE.Plane(new THREE.Vector3(-1,0,0),-1.40)];
 return [];
}
