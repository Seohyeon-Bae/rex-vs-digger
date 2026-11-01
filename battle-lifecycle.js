// A pending request must be released if the battle ended or became hidden meanwhile.
export function createScreenAwake({wakeLock=globalThis.navigator?.wakeLock,visible=()=>!document.hidden}={}){
 let wanted=false,lock=null,pending=null,failed=false;
 async function sync(active){
  if(wanted!==!!active)failed=false;wanted=!!active;
  if(!wanted||!visible()){const old=lock;lock=null;if(old&&!old.released)await old.release().catch(()=>{});return;}
  if(!wakeLock||lock&&!lock.released||pending||failed)return;
  pending=wakeLock.request('screen').then(async acquired=>{
   if(!wanted||!visible()){await acquired.release();return;}
   lock=acquired;acquired.addEventListener('release',()=>{if(lock===acquired)lock=null;},{once:true});
  }).catch(()=>{failed=true;}).finally(()=>{pending=null;});
  await pending;
 }
 return{sync,retry(){failed=false;return sync(wanted);}};
}
