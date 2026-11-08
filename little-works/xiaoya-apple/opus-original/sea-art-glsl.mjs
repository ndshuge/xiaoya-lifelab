// Incremental coastal palette for the existing opaque water shader.
// Procedural seabed, nearshore caustics, fish silhouettes and on-tap surface rings.
// The parent ocean owns waveHeight and all scene lighting; no new render pass or textures.
export function seaArtFragment({fishCount,lite=false}={}) {
  if (!Number.isInteger(fishCount)||fishCount<1||fishCount>20) throw Error('fishCount must be 1..20');
  const head = `
uniform vec4 uFish[${fishCount}]; // x, z, direction, fish length
uniform vec4 uTaps[3]; // x, z, birth time, strength
uniform vec4 uBeacon; // lighthouse x, z, present, strength
float seaHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float seaNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(seaHash(i),seaHash(i+vec2(1.,0.)),f.x),mix(seaHash(i+vec2(0.,1.)),seaHash(i+vec2(1.,1.)),f.x),f.y);}
float caustics(vec2 p,float t){
 vec2 q=p*3.9+vec2(t*.46,-t*.28);
 float a=sin(q.x+1.9*sin(q.y*.77+t*.42));
 float b=sin(q.y*.88-1.7*sin(q.x*.74-t*.31));
 return pow(smoothstep(.55,1.,a*b*.5+.5),3.);
}
vec3 seabed(vec2 p,float depth,float t){
 float ripple=sin(dot(p,vec2(1.0,.62))*7.6+seaNoise(p*1.25)*3.2);
 vec3 sand=vec3(.75,.68,.52)*(1.+ripple*.067+(.5-seaNoise(p*2.7))*.065);
 float grassZone=smoothstep(.25,.72,seaNoise(p*.73+vec2(2.7,1.3)))*(1.-smoothstep(2.7,5.4,depth));
 float grassBlade=pow(1.-abs(sin(p.y*18.+sin(p.x*2.7+t*.22)*2.)),9.);
 float grass=grassZone*(.33+.48*grassBlade);
 sand=mix(sand,vec3(.23,.39,.30),grass);
 ${lite?'':`vec2 cell=floor(p*1.05),f=fract(p*1.05)-.5;float peb=seaHash(cell+vec2(4.,8.));
 if(peb>.76){vec2 center=vec2(seaHash(cell+1.2)-.5,seaHash(cell+2.5)-.5)*.34;
 float d=length((f-center)*vec2(1.,1.3));
 float rock=(1.-smoothstep(.12,.27,d))*smoothstep(.2,1.8,depth)*(1.-smoothstep(3.6,6.,depth));
 sand=mix(sand,vec3(.35,.39,.34)*(1.+.2*seaNoise(p*5.)),rock*.85);
 }`}
 return sand;
}
vec3 paintFish(vec3 water,vec2 p,float e,float night){
 if(e<1.045||e>1.96)return water;
 for(int i=0;i<${fishCount};i++){
  vec4 fish=uFish[i];vec2 d=p-fish.xy;
  float s=fish.w;if(abs(d.x)>s*3.||abs(d.y)>s*3.)continue;
  vec2 forward=vec2(cos(fish.z),sin(fish.z));
  vec2 f=vec2(dot(d,forward),dot(d,vec2(-forward.y,forward.x)));
  float body=1.-smoothstep(.75,1.,length(f/vec2(s*1.28,s*.52)));
  float tail=1.-smoothstep(.0,.12,abs(f.x+s*1.25)-(-f.x-s*.70)*.33);
  tail*=1.-smoothstep(s*.13,s*.5,abs(f.y));
  tail*=smoothstep(-s*1.9,-s*.93,f.x)*(1.-smoothstep(-s*.88,-s*.55,f.x));
  float shape=max(body,tail*.72);
  float shade=.3+.7*(1.-smoothstep(1.2,1.9,e));
  float gold=mod(float(i),3.);
  vec3 ink=mix(vec3(.17,.37,.39),vec3(.65,.44,.28),step(.5,gold));
  ink=mix(ink,vec3(.40,.52,.31),step(1.5,gold));
  water=mix(water,ink*(.8+night*.05),shape*shade*.78);
 }
 return water;
}
float lighthouseSweep(vec2 p,float t,float night){
 if(uBeacon.z<.5||night<.025)return 0.;
 vec2 to=p-uBeacon.xy;float d=length(to);
 if(d<.45||d>14.)return 0.;
 vec2 beam=vec2(cos(t*.32),sin(t*.32));
 return pow(max(0.,dot(to/d,beam)),18.)*(1.-smoothstep(4.,14.,d))*night*uBeacon.w;
}
vec3 seaArtColor(vec3 water,vec2 p,float e,float t,float night){
 float depth=max(0.,e-1.02)*6.8;
 float visibility=exp(-depth*.73)*smoothstep(1.02,1.11,e)*(1.-night*.79);
 vec3 bed=seabed(p,depth,t);
 float focus=caustics(p,t)*(1.-night*.92)*exp(-depth*.37);
 bed=bed*(1.+focus*.32)+vec3(.12,.15,.10)*focus;
 vec3 mixed=mix(water,bed,visibility*.68);
 mixed+=vec3(.29,.23,.13)*lighthouseSweep(p,t,night);
 return paintFish(mixed,p,e,night);
}
float tapFoam(vec2 p,float time){
 float foam=0.;
 for(int i=0;i<3;i++){
  vec4 tap=uTaps[i];float age=time-tap.z;
  if(age<0.||age>3.2||tap.w<.01)continue;
  float d=length(p-tap.xy);float ring=age*.83;
  foam=max(foam,(1.-smoothstep(.045,.16,abs(d-ring)))*exp(-age*.9)*tap.w);
 }
 return foam;
}
`;
  const color = `col=seaArtColor(col,p,e,uTime,uNight);
col=mix(col,vec3(.82,.92,.84),tapFoam(p,uTime)*(1.-uNight*.35)*.76);`;
  return {head,color};
}