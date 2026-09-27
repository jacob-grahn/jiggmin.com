import test from 'node:test';
import assert from 'node:assert/strict';
import {RecoveryQueue} from '../web/library-behavior.js';

test('Recovery skips untouched cartridges and waits five seconds after the latest movement',()=>{
 const q=new RecoveryQueue();q.moved('untouched',0);q.touch('cart',0);
 assert.equal(q.next(['untouched','cart'],4),null);
 q.moved('cart',4.5);
 assert.equal(q.next(['untouched','cart'],5),null);
 assert.equal(q.next(['untouched','cart'],9.49),null);
 assert.equal(q.next(['untouched','cart'],10.49),'cart');
});
test('Recovery checks only one eligible cartridge per second in round-robin order',()=>{
 const q=new RecoveryQueue(),ids=['a','b','c'];ids.forEach(id=>q.touch(id,0));
 assert.equal(q.next(ids,5),'a');assert.equal(q.next(ids,5.99),null);
 assert.equal(q.next(ids,6,id=>id!=='b'),'c');
 assert.equal(q.next(ids,7),'a');assert.equal(q.next(ids,8),'b');
 assert.equal(q.next(ids,100),'c');assert.equal(q.next(ids,100),null);
 q.defer(101);assert.equal(q.next(ids,101.99),null);assert.equal(q.next(ids,102),'a');
});
