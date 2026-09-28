import {GLTFLoader as BaseGLTFLoader} from './vendor/three/GLTFLoader.js';
import {DRACOLoader} from './vendor/three/DRACOLoader.js';

// Shared by the den and house. Decoder downloads/workers start only when needed.
const decoder=new DRACOLoader();
decoder.setDecoderPath('/web/vendor/draco/');
decoder.setWorkerLimit(2);
export class GLTFLoader extends BaseGLTFLoader{
  constructor(manager){super(manager);this.setDRACOLoader(decoder);}
}
