// A view is a destination; scale keeps the last paper-island magnification for old callers.
export const VIEW_IDS=Object.freeze(['day','week','line','pocket','journal']);
export const SCALE_IDS=Object.freeze(['day','week','line']);
export function normalizeView(saved){
 const candidate=saved&&typeof saved==='object'?(saved.view??saved.scale):null;
 return VIEW_IDS.includes(candidate)?candidate:'day';
}
export function rememberedScale(view,scale){
 if(SCALE_IDS.includes(view))return view;
 return SCALE_IDS.includes(scale)?scale:'day';
}
