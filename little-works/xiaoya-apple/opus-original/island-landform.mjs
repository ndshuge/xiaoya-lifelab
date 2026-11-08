// Shared coastline geometry: the sea and the land use the same 64 polar samples.
import * as T from './vendor/three/three.module.min.js';
export function coastRadii(){return Array.from({length:64},(_,i)=>{
 const a=i/64*Math.PI*2,r=1.025+.052*Math.sin(a*3+.7)+.023*Math.sin(a*5-1.1)+.009*Math.cos(a*9+.4);
 // The minimum keeps the established walkable ellipse supported by solid land.
 return Math.max(.952,r);
});}
export function coastRadius(a){const samples=coastRadii(),n=((a/(Math.PI*2)%1)+1)%1*64,i=Math.floor(n);return T.MathUtils.lerp(samples[i],samples[(i+1)%64],n-i);}

/** A capped bevelled land mass, with a thin soil lip and a continuous wet/dry beach. */
export function createLandform(bounds,M){
 const root=new T.Group();root.name='crafted-landform';
 const bands=[{s:1.035,y:-.07,c:0x9ca58e},{s:1.015,y:.012,c:0xc2b68c},{s:.993,y:.085,c:0xd4c49c},{s:.978,y:.12,c:0xb1ac91},{s:.965,y:.19,c:0xa9a387},{s:.962,y:.245,c:0xa7a184},{s:.956,y:.292,c:0x999674},{s:.951,y:.317,c:0x6f895c},{s:.943,y:.34,c:0xa8bc82}];
 const pos=[],col=[],uv=[],N=128;
 const site=(i,b)=>{const a=i/N*Math.PI*2,r=coastRadius(a)*b.s;
  const cliff=b.y>.10&&b.y<.30;
  const scallop=.003*Math.sin(a*17+.2)+(cliff?.008*Math.sin(a*23+b.y*35)+.003*Math.cos(a*41):0),rise=cliff?.018*Math.sin(a*4+.8):0;
  return new T.Vector3(Math.cos(a)*bounds.rx*(r+scallop),b.y+rise,Math.sin(a)*bounds.rz*(r+scallop));};
 const colour=(b,i)=>{const a=i/N*Math.PI*2;return new T.Color(b.c).multiplyScalar(1+.035*Math.sin(a*7)+.018*Math.cos(a*13));};
 const add=(p,c)=>{pos.push(p.x,p.y,p.z);col.push(c.r,c.g,c.b);uv.push(p.x/bounds.rx*.5+.5,p.z/bounds.rz*.5+.5);};
 for(let b=0;b<bands.length-1;b++)for(let i=0;i<N;i++){
  const a=site(i,bands[b]),c=site(i,bands[b+1]),d=site(i+1,bands[b+1]),e=site(i+1,bands[b]);
  add(a,colour(bands[b],i));add(c,colour(bands[b+1],i));add(e,colour(bands[b],i+1));add(e,colour(bands[b],i+1));add(c,colour(bands[b+1],i));add(d,colour(bands[b+1],i+1));
 }
 const top=bands.at(-1),centre=new T.Vector3(0,.34,0),cc=new T.Color(0xb1c58e);
 for(let i=0;i<N;i++){add(centre,cc);add(site(i+1,top),colour(top,i+1));add(site(i,top),colour(top,i));}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('color',new T.Float32BufferAttribute(col,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.computeVertexNormals();geo.computeBoundingSphere();
 const mat=M('crafted-land',0xffffff,{map:null,normalMap:null,vertexColors:true,roughness:1});
 const land=new T.Mesh(geo,mat);land.name='sand-cliff-meadow';land.castShadow=true;land.receiveShadow=true;root.add(land);
 return root;
}
