// Scene-independent guard for sea interaction. Keep object picking and orbit drags authoritative.
export function canTapWater({bounds,x,z,picked=false,dragged=false,reduced=false}={}) {
 if(picked||dragged||reduced||!Number.isFinite(x)||!Number.isFinite(z)||!(bounds?.rx>0&&bounds?.rz>0))return false;
 const e=Math.hypot(x/bounds.rx,z/bounds.rz);
 return e>=1.04&&e<=2.15;
}
