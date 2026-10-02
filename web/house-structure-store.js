// Own async shell loads separately from props. Invalidated loads never reattach.
export function createStructureStore({load,dispose}){
 const entries=new Map(),pending=new Map(),versions=new Map();let closed=false;
 function remove(id){versions.set(id,(versions.get(id)??0)+1);const value=entries.get(id);entries.delete(id);if(value)dispose(value,id);}
 async function ensure(id){
  if(closed)return null;
  if(entries.has(id))return entries.get(id);
  if(pending.has(id))return pending.get(id);
  const version=versions.get(id)??0;
  const request=(async()=>{
   const value=await load(id);
   if(closed||version!==(versions.get(id)??0)){dispose(value,id);return null;}
   entries.set(id,value);return value;
  })().finally(()=>{if(pending.get(id)===request)pending.delete(id);});
  pending.set(id,request);return request;
 }
 return {entries,ensure,remove,async dispose(){closed=true;for(const id of [...entries.keys()])remove(id);await Promise.allSettled([...pending.values()]);}};
}
