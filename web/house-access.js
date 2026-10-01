import * as T from 'three';
const smooth=(p,a,b)=>{const x=T.MathUtils.clamp((p-a)/(b-a),0,1);return x*x*(3-2*x);};
export function hingeMatrix(point,axis,angle){return new T.Matrix4().makeTranslation(...point).multiply(new T.Matrix4().makeRotationAxis(new T.Vector3(...axis),angle)).multiply(new T.Matrix4().makeTranslation(...point.map(x=>-x)));}
const hinges={mudroom:[[10,0,6.8],[0,1,0],Math.PI/2],garage:[[12,0,6.1],[0,1,0],Math.PI/2],stairs:[[11,0,8.3],[0,1,0],Math.PI/2],den:[[4.8,0,10.034],[0,1,0],Math.PI/2],attic:[[9.95,2.61,7.55],[0,0,1],Math.PI/2]};
export function doorMotion(id,progress){const h=hinges[id];return h?hingeMatrix(h[0],h[1],h[2]*smooth(progress,0,id==='attic'?.08:.12)):new T.Matrix4();}
export function ladderMotion(section,progress){
 const closed=1-smooth(progress,.06,.17),a=new T.Vector3(7.92,0,7.55),b=new T.Vector3(9.82,2.8,7.55),joint=t=>a.clone().lerp(b,t).toArray();
 const matrix=hingeMatrix(joint(1),[0,0,1],-Math.atan2(2.8,1.9)*closed);
 if(section<2)matrix.multiply(hingeMatrix(joint(2/3),[0,0,1],Math.PI*closed));
 if(section<1)matrix.multiply(hingeMatrix(joint(1/3),[0,0,1],-Math.PI*closed));
 return matrix;
}
