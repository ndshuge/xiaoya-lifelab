// Optional, entirely synthesized surf ambience. Audio is created only after an explicit user gesture.
// No media file, network request, autoplay, microphone permission or persistent setting.
export function createOceanAudio({
 Context=globalThis.AudioContext||globalThis.webkitAudioContext||null,
 setIntervalFn=globalThis.setInterval.bind(globalThis),
 clearIntervalFn=globalThis.clearInterval.bind(globalThis)
}={}){
 let context=null,source=null,master=null,foam=null,timer=null,playing=false,disposed=false,t=0;

 function build(){
  context=new Context();
  // Slowly integrated, seeded noise is less brittle than white-noise surf.
  const length=Math.max(1024,Math.round(context.sampleRate*9));
  const buffer=context.createBuffer(1,length,context.sampleRate),samples=buffer.getChannelData(0);
  let seed=82193,brown=0;
  for(let i=0;i<length;i++){
   seed=(seed*16807)%2147483647;
   const white=seed/1073741823.5-1;
   brown=(brown+.027*white)/1.027;
   samples[i]=brown*3.2;
  }
  source=context.createBufferSource();source.buffer=buffer;source.loop=true;
  const body=context.createBiquadFilter();body.type='lowpass';body.frequency.value=1020;body.Q.value=.65;
  const rumble=context.createBiquadFilter();rumble.type='highpass';rumble.frequency.value=58;rumble.Q.value=.6;
  const spray=context.createBiquadFilter();spray.type='highpass';spray.frequency.value=490;spray.Q.value=.65;
  master=context.createGain();master.gain.value=0;
  foam=context.createGain();foam.gain.value=.035;
  source.connect(body);body.connect(rumble);rumble.connect(master);
  source.connect(spray);spray.connect(foam);foam.connect(master);
  master.connect(context.destination);
  source.start(0);
 }
 function swell(){
  if(!context||!playing)return;
  t+=.16;
  const wave=.55+.29*Math.sin(t*.65)+.14*Math.sin(t*.31+1.1);
  master.gain.setTargetAtTime(.09+.19*wave,context.currentTime,.3);
  foam.gain.setTargetAtTime(.02+.11*Math.pow(Math.max(0,wave),2),context.currentTime,.3);
 }
 function clearTimer(){
  if(timer!==null){clearIntervalFn(timer);timer=null}
 }
 return {
  isPlaying(){return playing},
  async start(){
   if(disposed||!Context)return false;
   if(playing)return true;
   try{
    if(!context)build();
    await context.resume(); // invoked only from the click handler (iOS Safari user gesture)
    playing=true;
    swell();
    timer=setIntervalFn(swell,160);
    return true;
   }catch{
    playing=false;clearTimer();return false;
   }
  },
  async stop(){
   playing=false;clearTimer();
   if(context&&context.state!=='closed'){
    master.gain.setTargetAtTime(0,context.currentTime,.04);
    try{await context.suspend()}catch{/* user may have closed the tab */}
   }
   return false;
  },
  async dispose(){
   if(disposed)return;
   disposed=true;playing=false;clearTimer();
   try{source?.stop()}catch{}
   try{source?.disconnect()}catch{}
   try{await context?.close()}catch{}
   source=null;master=null;foam=null;context=null;
  }
 };
}
