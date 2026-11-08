// One-pass stylized underwater color. No external images or geometry assets.
// The Three.js host supplies hash()/noise(), uTime and uCoast.
export function shoreDepth(distance){
 const d=Math.max(0,Number.isFinite(distance)?distance:0);
 return .12+.38*d+1.4*Math.min(1,Math.max(0,(d-.2)/3))**2;
}
export function createOceanArtShader({lite=false}={}){
 const reef=lite?'':`
float reefBed(vec2 p){
  vec2 id=floor(p*1.6);
  vec2 q=fract(p*1.6)-.5;
  float pick=hash(id+vec2(7.2,19.7));
  float rock=1.-smoothstep(.13,.33,length(q-vec2(hash(id+1.)-.5,hash(id+2.)-.5)*.35));
  return rock*step(.88,pick);
}
`;
 return `
float sandBed(vec2 p){
 float sweep=dot(p,vec2(.83,.55))*8. + noise(p*.63)*3.2;
 float bands=sin(sweep)*.45+sin(sweep*1.88+1.2)*.16;
 return .89+.08*bands+.09*noise(p*2.7);
}
float grassBed(vec2 p){
 vec2 cell=floor(p*1.4),local=fract(p*1.4)-.5;
 float seed=hash(cell+vec2(14.3,9.1));vec2 offset=(vec2(hash(cell+1.7),hash(cell+7.3))-.5)*.35;
 vec2 d=local-offset;float cover=step(.85,seed)*(1.-smoothstep(.11,.33,length(d)));
 float blade=.5+.5*sin((d.x+sin(d.y*5.)*.12)*38.)*sin(d.y*28.+seed*6.);
 return cover*(.42+.58*abs(blade))*.55;
}
${reef}
float caustics(vec2 p,float t){
 // Two warped traveling interference lattices rather than a texture lookup.
 vec2 q=p*4. + .34*vec2(sin(p.y*2.+t*.63),cos(p.x*2.-t*.73));
 float a=sin(q.x*1.27+t*.68)+sin(q.y*1.12-t*.56);
 float b=sin(q.x*.76-q.y*.92-t*.42);
 return pow(clamp(.5+.25*a+.2*b,0.,1.),7.);
}
vec3 oceanArt(vec2 p,float e,float uTime,float night){
 float d=max(0.,e-1.);
 float depth=.12+d*1.8+smoothstep(.25,1.4,d)*1.45;
 vec3 sand=vec3(.79,.73,.58)*sandBed(p);
 float beds=grassBed(p)*smoothstep(.01,.15,d)*(1.-smoothstep(.8,1.35,d));
 sand=mix(sand,vec3(.16,.31,.23),beds*.8);
 ${lite?'':`float reef=reefBed(p)*smoothstep(.1,.3,d)*(1.-smoothstep(1.1,1.8,d));sand=mix(sand,vec3(.35,.39,.32),reef*.48);`}
 float light=caustics(p,uTime)*(1.-smoothstep(.8,1.85,d))*(1.-night*.9);
 sand+=vec3(.2,.24,.17)*light*.27;
 // Shallow sand remains visible, pigments lose warmth with increasing depth.
 vec3 medium=vec3(.12,.47,.49);
 float absorption=1.-exp(-depth*.75);
 vec3 col=mix(sand,medium,clamp(absorption,0.,.94));
 return mix(col,vec3(.026,.20,.29),smoothstep(.65,2.0,d));
}
`;
}
