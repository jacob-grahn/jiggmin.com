import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {TV_BOUNDS,repairDenProjection} from '../web/den-projection.js';

test('TV occlusion volume separates the actual screen from the projected copy on the back wall',()=>{
 const eye=new THREE.Vector3(.12,3,7.9),screen=new THREE.Vector3(0,2.2,.4);
 const ray=new THREE.Ray(eye,screen.clone().sub(eye).normalize());
 const wall=ray.at((-1.88-eye.z)/ray.direction.z,new THREE.Vector3());
 const entry=ray.intersectBox(TV_BOUNDS,new THREE.Vector3());
 assert.ok(entry.distanceTo(eye)>screen.distanceTo(eye));
 assert.ok(entry.distanceTo(eye)<wall.distanceTo(eye));
 assert.ok(wall.z<TV_BOUNDS.min.z-.025);
});

test('projection repair affects only the travel material, preserving moving prop bakes',()=>{
 const source=new THREE.ShaderMaterial({uniforms:{lighting:{value:new THREE.Texture()},bakeProjection:{value:new THREE.Matrix4()}},vertexShader:'void main(){}',fragmentShader:'uniform sampler2D lighting;void main(){gl_FragColor=texture2D(lighting,vec2(0.));}'});
 const clone=source.clone(),camera=new THREE.PerspectiveCamera();camera.position.set(.12,3,7.9);
 repairDenProjection(clone,camera,new THREE.Matrix4());
 assert.ok(clone.fragmentShader.includes('gl_FragColor=denLighting('));
 assert.ok(!source.fragmentShader.includes('denLighting'));
 assert.equal(clone.uniforms.denProjectionRepair.value,0,'original den view must use its untouched baked plate');
 assert.deepEqual(clone.uniforms.denBakeEye.value.toArray(),[.12,3,7.9]);
 const prop=source.clone();prop.uniforms.bakeModelMatrix={value:new THREE.Matrix4()};
 repairDenProjection(prop,camera,new THREE.Matrix4());assert.equal(prop.fragmentShader,source.fragmentShader);
});
