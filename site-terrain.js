import {seededRandom} from './engine.js';

export const SITE_GROUND='#696557';
export function ruinSites(b){
 const R=b.radius,n=Math.min(6,2+Math.floor((R-36)/50)),positions=[[-.67,.62],[.66,-.65],[-.72,-.55],[.7,.58],[.2,.78],[-.24,-.76]];
 return positions.slice(0,n).map(([x,z],i)=>({x:x*R,z:z*R,radius:Math.min(12,4.5+R*.025)*(i%2?.7:1),phase:(i*.271+b.config.seed*.003)%1}));
}
export function fireSites(b){
 const R=b.radius,positions=[[-.53,-1.12],[.86,.66],[-.82,.7],[1.12,-.43],[.62,1.08],[-1.1,-.3]],n=Math.min(6,3+Math.floor((R-36)/65));
 return positions.slice(0,n).map(([x,z],i)=>({x:x*R,z:z*R,phase:(b.config.seed*.007+i*.219)%1,intensity:i%2?1:1.25}));
}
export function outerFireSites(b){return cityLayout(b).fires;}
const cityCache=new WeakMap();
// A fixed street grid surrounds a single central construction superblock.
export function cityLayout(b){
 if(cityCache.has(b))return cityCache.get(b);
 const R=b.radius,random=seededRandom(b.config.seed+184731),scale=Math.min(1.6,Math.sqrt(R/36)),s=scale,inner=R+(R>90?22:16)*s,mid=inner+49*s,outer=mid+51*s,nearExtent=outer+42*s,extent=Math.max(nearExtent*2.5,R*6),farRoad=outer+(extent-outer)*.48;
 const axes=[-outer,-mid,-inner,...(R>90?[-R*.48,0,R*.48]:[0]),inner,mid,outer],buildings=[],parcels=[],cars=[],lamps=[],rubble=[],fires=[],roads=[],distant=[],vacant=[];
 for(const axis of ['x','z'])for(const at of axes){if(Math.abs(at)<inner-.1){roads.push({axis,at,start:-extent,end:-inner},{axis,at,start:inner,end:extent});}else roads.push({axis,at,start:-extent,end:extent});}
 for(let ix=0;ix<axes.length-1;ix++)for(let iz=0;iz<axes.length-1;iz++){
  const x0=axes[ix],x1=axes[ix+1],z0=axes[iz],z1=axes[iz+1],cx=(x0+x1)/2,cz=(z0+z1)/2;
  if(Math.abs(cx)<inner&&Math.abs(cz)<inner)continue;
  const margin=7.6*s,left=x0+margin,right=x1-margin,top=z0+margin,bottom=z1-margin,w=right-left,d=bottom-top;if(w<4||d<4)continue;
  const parcel={x:cx,z:cz,w:x1-x0-11*s,d:z1-z0-11*s,ix,iz};parcels.push(parcel);
  const split=Math.max(w,d)>48*s?2:1;
  for(let slot=0;slot<split;slot++){
   const horizontal=w>d,pw=split>1&&horizontal?w/2:w,pd=split>1&&!horizontal?d/2:d,px=cx+(split>1&&horizontal?(slot-.5)*w/2:0),pz=cz+(split>1&&!horizontal?(slot-.5)*d/2:0),originalType=(ix*3+iz*5+slot*3)%8,near=Math.max(Math.abs(cx),Math.abs(cz))<=mid,type=near&&originalType===2?0:originalType,turn=(horizontal?0:1)+(type===3?1:0),yaw=turn%2*Math.PI/2;
   const proportions=[[.91,.58],[.89,.48],[.55,.66],[.91,.83],[.68,.78],[.62,.87],[.87,.67],[.57,.77]][type];let bw=pw*(proportions[0]-.08+random()*.14),bd=pd*(proportions[1]-.08+random()*.14);
   if((ix*7+iz*11+slot)%13===4){vacant.push({x:px,z:pz,w:pw*.91,d:pd*.9});continue;}
   const worldW=bw,worldD=bd,localW=yaw?worldD:worldW,localD=yaw?worldW:worldD,rawHeight=[7+random()*4,20+random()*13,29+random()*23,7+random()*4,10+random()*5,17+random()*14,8+random()*4,9+random()*7][type]*s*(.68+random()*.48),h=near?Math.min(rawHeight,[14,13.4,9,8.5,13,14,15.4,9][type]*s):rawHeight;
   buildings.push({x:px+(random()-.5)*Math.max(0,pw-worldW)*.75,z:pz+(random()-.5)*Math.max(0,pd-worldD)*.75,yaw,w:localW,d:localD,h,type,plan:(ix+iz*2+slot)%5===0?'U':(ix*3+iz+slot)%3===0?'L':'bar',roofPitch:.08+random()*.17,roofStyle:random()>.52?1:0,row:Math.max(Math.abs(cx),Math.abs(cz))>mid?2:0,damage:random(),variation:random(),lot:{left,right,top,bottom}});
   if((ix+iz+slot)%4===0)rubble.push({x:px-worldW*.35,z:pz+worldD*.36,yaw:0,size:1.1*s+random()*s,seed:Math.floor(random()*10000)});
  }
 }
 // A second, low-detail district continues the same street grid into the distance.
 const distantAxes=[-extent,-farRoad,...axes,farRoad,extent];
 for(const axis of ['x','z'])for(const at of [-farRoad,farRoad,-extent,extent])roads.push({axis,at,start:-extent,end:extent,distant:true});
 for(let ix=0;ix<distantAxes.length-1;ix++)for(let iz=0;iz<distantAxes.length-1;iz++){
  const x0=distantAxes[ix],x1=distantAxes[ix+1],z0=distantAxes[iz],z1=distantAxes[iz+1],x=(x0+x1)/2,z=(z0+z1)/2;
  if(Math.abs(x)<outer&&Math.abs(z)<outer)continue;
  const cellW=x1-x0,cellD=z1-z0,w=(cellW-13*s)*(.7+random()*.14),d=(cellD-13*s)*(.68+random()*.16),type=(ix*3+iz*7)%5;
  if(w<3||d<3)continue;
  distant.push({x,z,w,d,h:(12+type*7+random()*10)*s+Math.min(32,Math.min(w,d)*.16),type,variation:random(),blockW:cellW-11*s,blockD:cellD-11*s});
 }
 // Side streets continue to the edge, including the four corner intersections.
 for(let side=0;side<4;side++){
  const yaw=side*Math.PI/2,tx=Math.cos(yaw),tz=Math.sin(yaw),nx=-tz,nz=tx;
  for(let i=0;i<4;i++){const along=(-.72+i*.48)*R;cars.push({x:tx*along+nx*(inner+1.5*s),z:tz*along+nz*(inner+1.5*s),yaw:yaw+(i===2?.32:0),type:(i+side)%4,scale:Math.min(1.15,s)});lamps.push({x:tx*along+nx*(inner+6.2*s),z:tz*along+nz*(inner+6.2*s),yaw,broken:(i+side)%3===0,scale:s});}
  fires.push({x:tx*(side%2?.58:-.45)*R+nx*(inner+4*s),z:tz*(side%2?.58:-.45)*R+nz*(inner+4*s),phase:random(),intensity:.75+random()*.4});
 }
 const layout={buildings,parcels,roads,axes,distant,distantAxes,vacant,cars,lamps,rubble,fires,scale,inner,mid,outer,nearExtent,extent};cityCache.set(b,layout);return layout;
}
export function cityExtent(b){return cityLayout(b).extent;}
const cityGeometryCache=new WeakMap();
function apocalypseCity(r){
 const mode=r.gl&&!r.gpuLost?'gpu':'canvas';let cached=cityGeometryCache.get(r);
 if(!cached||cached.battle!==r.battle||cached.mode!==mode){const commands=[],recorder={battle:r.battle,transform:(...args)=>r.transform(...args)};for(const name of ['box','poly','beam'])recorder[name]=(...args)=>commands.push([name,args]);buildApocalypseCity(recorder);cached={battle:r.battle,mode,commands};cityGeometryCache.set(r,cached);}
 r.cityGeometry=true;for(const [name,args] of cached.commands)r[name](...args);r.cityGeometry=false;
}
function buildApocalypseCity(r){
 const b=r.battle,R=b.radius,city=cityLayout(b),s=city.scale,frame=(x,z,yaw=0)=>r.transform({x,y:0,z,yaw,roll:0,pitch:0,scale:1,team:'dig'});
 // Sidewalks are parcel-shaped; no kerb or centre line cuts across an intersection.
 for(const parcel of city.parcels){r.box(parcel.x,.10,parcel.z,parcel.w,.2,parcel.d,'#848b83');r.box(parcel.x,.215,parcel.z,parcel.w-.7*s,.035,parcel.d-.7*s,(parcel.ix+parcel.iz)%3===0?'#737c70':'#788172');}
 for(const road of city.roads){const vertical=road.axis==='x',length=road.end-road.start,center=(road.start+road.end)/2,T=frame(vertical?road.at:center,vertical?center:road.at,vertical?Math.PI/2:0);r.box(0,.018,0,length,.045,10*s,'#414b4b',T);
  const count=Math.min(52,Math.ceil(length/(7*s)));for(let i=0;i<count;i++){const at=road.start+(i+.5)*length/count;if(city.distantAxes.some(c=>Math.abs(c-at)<6.6*s))continue;r.box(at-center,.052,0,Math.min(3.1*s,length/count*.45),.026,.14*s,'#c3b78c',T);for(const side of [-1,1])r.box(at-center,.05,side*4.4*s,Math.min(4.7*s,length/count*.8),.02,.10*s,'#a5afa0',T);}
 }
 for(const x of city.axes)for(const z of city.axes){if(Math.abs(x)<city.inner-.1&&Math.abs(z)<city.inner-.1)continue;for(const side of [-1,1])for(let stripe=0;stripe<5;stripe++){r.box(x+(stripe-2)*1.1*s,.06,z+side*6.3*s,.55*s,.025,2*s,'#aeb7a4');r.box(x+side*6.3*s,.06,z+(stripe-2)*1.1*s,2*s,.025,.55*s,'#aeb7a4');}}
 // Distant blocks use four to eight boxes each, sharing the static terrain cache.
 for(const v of city.distant){const {x,z,w,d,h,type,variation,blockW,blockD}=v,T=frame(x,z),base=['#6b7d71','#748176','#647c73','#7d8376','#6b7c70'][type];
  r.box(0,.11,0,blockW,.2,blockD,'#7c8878',T);r.box(-w*.13,h*.5,0,w*.72,h,d,base,T);r.box(w*.36,h*.34,d*.1,w*.28,h*.68,d*.8,'#718275',T);r.box(-w*.13,h+.12,0,w*.75,.24*s,d+.3*s,'#899582',T);
  if(type===1||type===3){for(let floor=0;floor<3;floor++){const y=h*(.24+floor*.23);r.box(-w*.13,y,-d/2-.05,w*.63,.5*s,.08,'#526e60',T);r.box(-w*.13,y,d/2+.05,w*.63,.5*s,.08,'#526e60',T);}}
  else if(type===2){r.box(-w*.13,h+2.7*s,0,w*.18,5*s,d*.22,'#657d6b',T);}
  else if(type===4&&variation>.4){r.box(w*.26,h*.85,d*.25,1.6*s,h*1.7,1.6*s,'#687a65',T);}
 }
 for(const gap of city.vacant){r.box(gap.x,.255,gap.z,gap.w,.05,gap.d,'#576b54');for(let line=0;line<4;line++)r.box(gap.x-gap.w*.35+line*gap.w*.23,.292,gap.z,.09*s,.025,gap.d*.63,'#a3ac8a');r.box(gap.x-gap.w*.38,.5*s,gap.z+gap.d*.36,gap.w*.23,.7*s,.6*s,'#7d8b6d',null,.08);}
 const palette=['#957b68','#8c9183','#647a78','#777e6b','#a09b83','#7a8174','#78877a','#797c68'];
 for(const v of city.buildings){const {x,z,yaw,h,type,damage,variation,row,plan,roofPitch,roofStyle}=v,far=row===2,base=palette[type],dark='#3a4b42',roof='#697669',broken=damage>.65&&type!==3&&type!==6,whole=frame(x,z,yaw),ow=v.w,od=v.d;
  let w=ow,d=od,T=whole;
  // The main volume and attached wings form real courtyards and L-shaped outlines.
  if(plan==='L'||plan==='U'){const ox=plan==='L'?-ow*.16:0,oz=plan==='L'?-od*.225:-od*.35;w=plan==='L'?ow*.68:ow;d=plan==='L'?od*.55:od*.3;T=frame(x+ox*Math.cos(yaw)-oz*Math.sin(yaw),z+ox*Math.sin(yaw)+oz*Math.cos(yaw),yaw);}

  const slab=(y,width=w,depth=d,col=roof,px=0,pz=0)=>r.box(px,y,pz,width,.18*s,depth,col,T);
  const win=(px,y,pz,ww,hh,face=0,col='#394f49')=>r.box(px,y,pz,face? .065:ww,hh,face?ww:.065,col,T);
  const rows=(floors,cols,height=h,width=w,depth=d,balk=false)=>{for(let floor=0;floor<floors;floor++){const y=2.3*s+floor*(height-3*s)/Math.max(1,floors);for(let col=0;col<cols;col++){const xx=(col-(cols-1)/2)*width/(cols+.6),windowColor=(floor+col+type)%5===0?'#83958b':'#344c46';for(const side of [-1,1]){win(xx,y,side*(depth/2+.06),width/(cols+1)*.58,1.35*s,0,windowColor);if(balk&&floor>0&&(floor+col)%3!==1){r.box(xx,y-.95*s,side*(depth/2+.65*s),width/(cols+.5)*.9,.15*s,1.25*s,'#a0a594',T);r.box(xx,y-.45*s,side*(depth/2+1.2*s),width/(cols+.5)*.9,.08*s,.07*s,'#5a6e5b',T);for(const post of [-1,1])r.box(xx+post*width/(cols+1)*.35,y-.7*s,side*(depth/2+1.2*s),.07*s,.6*s,.07*s,'#52664f',T);}}}if(!far)for(const side of [-1,1])for(const zz of [-depth*.26,depth*.26])win(side*(width/2+.06),y,zz,depth*.14,1.3*s,1);}};
  r.box(0,.28,0,w+.4*s,.5*s,d+.4*s,'#626f60',T);
  if(type===0){ // Individual shop fronts, masonry lintels and an awning, with a rear loft.
   r.box(0,h/2,0,w,h,d,base,T);rows(2,Math.min(4,Math.max(2,Math.floor(w/(4*s)))));slab(h+.15,w+.7*s,d+.7*s,'#a09b83');
   const shopCols=Math.min(4,Math.max(2,Math.floor(w/(6*s))));for(let i=0;i<shopCols;i++){const xx=(i-(shopCols-1)/2)*w/shopCols;r.box(xx,1.5*s,-d/2-.08,w/shopCols*.73,2.1*s,.12,'#364f47',T);r.box(xx,2.9*s,-d/2-.7*s,w/shopCols*.95,.2*s,1.7*s,i%2?'#6f5945':'#627c74',T);r.box(xx,3.45*s,-d/2-.1,w/shopCols*.87,.65*s,.12,'#8c9174',T);if((i+Math.floor(variation*8))%3===0)for(let p=0;p<3;p++)r.box(xx,1*s+p*.55*s,-d/2-.17,w/shopCols*.8,.24*s,.1,'#95866a',T);}
   r.box(w*.27,h+1*s,d*.1,w*.32,1.7*s,d*.42,'#858e7a',T);
  }else if(type===1){ // Apartments: regular balconies and a stair tower produce a different silhouette.
   r.box(-w*.1,h/2,0,w*.8,h,d,base,T);r.box(w*.4,h*.57,d*.06,w*.2,h*1.14,d*.78,'#788572',T);rows(Math.min(7,Math.floor(h/(3.7*s))),Math.min(4,Math.max(2,Math.floor(w/(5*s)))),h,w*.8,d,true);slab(h+.12,w*.82,d+.35*s,'#b0b39c',-w*.1);r.box(w*.4,h*1.14+.3*s,d*.06,w*.22,.5*s,d*.82,'#a7ac92',T);
  }else if(type===2){ // Glazed office tower on a solid podium, set back above its first storeys.
   r.box(0,2.2*s,0,w*1.12,4.4*s,d*1.12,'#7c897c',T);r.box(0,h/2+1.5*s,0,w*.83,h-3*s,d*.83,base,T);const floors=Math.min(11,Math.floor(h/(3.7*s))),cols=Math.min(5,Math.max(3,Math.floor(w/(3*s))));rows(floors,cols,h,w*.83,d*.83);for(const xx of [-w*.415,0,w*.415])r.box(xx,h*.5+1.4*s,-d*.417-.06,.16*s,h-2.8*s,.13*s,'#a1ada1',T);slab(h+.25,w*.88,d*.88,'#9aa899');r.box(w*.15,h+2*s,0,w*.38,3.5*s,d*.38,'#586e65',T);r.box(w*.15,h+5*s,0,.12*s,4*s,.12*s,'#9ca78f',T);
  }else if(type===3){ // Workshop/warehouse: a broad pitched roof, clerestory windows and loading doors.
   r.box(0,h*.43,0,w,h*.86,d,base,T);if(roofStyle)r.box(0,h*.93,0,w+.35*s,.25*s,d+.7*s,'#777a68',T,(variation>.5?1:-1)*roofPitch*.55);else for(const side of [-1,1])r.box(side*w*.245,h*.91,0,w*.53,.28*s,d+.7*s,'#777a68',T,-side*roofPitch);for(let i=0;i<4;i++){const xx=(i-1.5)*w/4;r.box(xx,h*.56,-d/2-.08,w/4*.68,h*.55,.13,'#455a4c',T);for(let line=0;line<5;line++)r.box(xx,h*.36+line*.6*s,-d/2-.16,w/4*.65,.075*s,.06,'#71816a',T);win(xx,h*.77,d/2+.08,w/4*.7,.85*s);}
   r.box(-w*.35,h+3.5*s,d*.22,1.5*s,7*s,1.5*s,'#615c49',T);r.box(-w*.35,h+7.1*s,d*.22,1.8*s,.35*s,1.8*s,'#8d8d73',T);r.box(w*.2,.7*s,-d*.62,w*.4,1.2*s,2*s,'#7b806a',T);
  }else if(type===4){ // A civic corner building: stone plinth, pitched roof and square corner tower.
   r.box(0,h*.42,0,w,h*.84,d,base,T);rows(3,3,h*.84);for(const side of [-1,1])r.box(side*w*.245,h*.87,0,w*.54,.25*s,d+.8*s,'#58695d',T,-side*roofPitch);r.box(-w*.3,h*.72,-d*.23,w*.32,h*.9,d*.34,'#9d9e87',T);r.box(-w*.3,h*1.2,-d*.23,w*.36,.35*s,d*.38,'#607264',T);win(-w*.3,h*.99,-d*.4-.07,w*.16,1.5*s);r.box(w*.1,1.4*s,-d/2-.13,w*.23,2.4*s,.18,'#4c604e',T);
  }else if(type===5){ // Exposed reinforced-concrete frame beside the still-standing stair core.
   const top=broken?h*.66:h*.88;r.box(w*.32,h/2,0,w*.36,h,d,base,T);r.box(-w*.18,top/2,d*.17,w*.64,top,d*.66,'#818a76',T);const floors=Math.min(6,Math.floor(h/(4*s)));for(let i=0;i<floors;i++){const yy=(i+1)*h/floors;slab(yy,w*.67,d*.97,'#969d85',-w*.16);for(const xx of [-w*.47,w*.12])for(const zz of [-d*.43,d*.43])r.box(xx,yy-h/floors/2,zz,.3*s,h/floors,.3*s,'#677961',T);}rows(Math.min(6,Math.floor(h/(4*s))),2,h,w*.33,d);for(let i=0;i<3;i++)r.beam([-w*.45+i*w*.2,h-.1,-d*.35],[-w*.43+i*w*.2,h+(1+i*.3)*s,-d*.35],.07*s,.07*s,'#485c46',T);
  }else if(type===6){ // Open parking decks with horizontal dark openings and ramps.
   r.box(0,h/2,0,w,h,d,'#596e5c',T);const floors=3;for(let i=0;i<=floors;i++){const yy=.5*s+i*h/floors;slab(yy,w+.5*s,d+.5*s,'#a0aa8e');if(i<floors){r.box(0,yy+1.1*s,-d/2-.1,w*.93,1.1*s,.12,'#304e3d',T);for(let col=0;col<5;col++)r.box((col-2)*w/4.3,yy+h/floors*.5,-d/2-.2,.3*s,h/floors,.15,'#92a084',T);}}r.beam([-w*.35,.8*s,-d*.48],[w*.35,h*.65,-d*.48],1*s,1.4*s,'#818e70',T);
  }else{ // Industrial utility block: tall chimney and steel-legged rooftop tank.
   r.box(0,h*.4,0,w,h*.8,d,base,T);rows(2,3,h*.8);slab(h*.8+.1,w+.5*s,d+.5*s,'#90977d');const tx=-w*.27,tz=d*.15;for(const xx of [-1.1,1.1])for(const zz of [-1,1])r.box(tx+xx*s,h*.8+2*s,tz+zz*s,.18*s,4*s,.18*s,'#4a654c',T);r.box(tx,h*.8+5.1*s,tz,3.3*s,2.6*s,3*s,'#738c77',T);r.box(tx,h*.8+6.45*s,tz,3.5*s,.18*s,3.2*s,'#a0ac8e',T);r.box(w*.32,h*.85,d*.15,1.7*s,h*1.7,1.7*s,'#6f6850',T);for(let band=1;band<4;band++)r.box(w*.32,h*.45+band*h*.3,d*.15,1.85*s,.18*s,1.85*s,'#99967a',T);
  }
  if(plan==='L'||plan==='U'){
   const wings=plan==='L'?[{x:ow*.34,z:-od*.015,w:ow*.32,d:od*.97}]:[-1,1].map(side=>({x:side*ow*.375,z:od*.15,w:ow*.25,d:od*.7}));
   for(let wingIndex=0;wingIndex<wings.length;wingIndex++){const a=wings[wingIndex],height=h*(.42+variation*.24+wingIndex*.09),shade=wingIndex?'#89917c':base;r.box(a.x,height/2,a.z,a.w,height,a.d,shade,whole);r.box(a.x,height+.12*s,a.z,a.w+.25*s,.22*s,a.d+.3*s,'#909980',whole,roofStyle?(wingIndex?-.035:.035):0);for(const side of [-1,1])r.box(a.x,height*.6,a.z+side*(a.d/2+.06),a.w*.68,.7*s,.065,'#425d48',whole);if(variation>.65)r.box(a.x-a.w*.15,height+1*s,a.z+a.d*.15,a.w*.42,1.6*s,a.d*.35,'#6b8066',whole);}
  }
  if(type!==3&&type!==7&&variation>.35){const roofY=type===4?h*.84:type===6?h+.6*s:h;for(let i=0;i<2;i++){r.box(w*.19-i*w*.28,roofY+.65*s,d*.15,1.7*s,1.1*s,1.4*s,'#536b56',T);r.box(w*.19-i*w*.28,roofY+1.23*s,d*.15,1.8*s,.09*s,1.5*s,'#8d9d80',T);}}
  if(broken&&type!==5){r.box(-w*.31,h*.56,-d/2-.09,w*.18,h*.24,.1,'#3f5140',T);r.beam([-w*.4,h*.68,-d/2-.17],[-w*.18,h*.42,-d/2-.17],.15*s,.1,'#a4aa8d',T);r.box(w*.25,.7*s,-d*.6,w*.2,1.2*s,d*.14,'#8e947b',T,.2);}
 }
 abandonedCityDetails(r,city,frame);
 for(const car of city.cars){const {x,z,yaw,type,scale:k}=car,T=frame(x,z,yaw),color=['#697564','#826655','#527b73','#77765e'][type],truck=type===3;
  r.box(0,.52*k,0,(truck?6.7:5)*k,.72*k,2.05*k,color,T);r.box(-.4*k,1.15*k,0,2.5*k,.72*k,1.85*k,'#3c5545',T,.07);r.box(-.35*k,1.57*k,0,2.6*k,.12*k,1.9*k,color,T,-.13);r.box(.7*k,1.2*k,0,.09,.5*k,1.65*k,'#29483b',T,.35);r.box(2*k,.7*k,-.5*k,1*k,.15*k,1.9*k,'#4e5e45',T,-.17);if(truck)r.box(2*k,1.45*k,0,2.6*k,1.7*k,2*k,'#8a8a6d',T);
  for(const cx of [-1.5,1.5])for(const cz of [-1,1])r.box(cx*k,.35*k,cz*k,.7*k,.7*k,.3*k,'#2a4130',T);r.box(-2.2*k,.65*k,-1.45*k,1.1*k,.2*k,.7*k,'#7d876b',T,.13);r.box(1.1*k,.64*k,-1.04*k,1.8*k,.42*k,.035,'#483d2f',T);r.box(-.4*k,1.34*k,-.94*k,1.7*k,.45*k,.04,'#2d3f31',T);
 }
 for(const lamp of city.lamps){const {x,z,yaw,broken,scale:k}=lamp,T=frame(x,z,yaw);r.box(0,.15,0,.8*k,.3,.8*k,'#7a8872',T);r.beam([0,.25,0],[broken?1.9*k:0,broken?3.4*k:7*k,0],.13*k,.13*k,'#5c765c',T);if(broken)r.beam([1.9*k,3.4*k,0],[3.3*k,.3,-.3*k],.12*k,.12*k,'#526c52',T);else{r.beam([0,7*k,0],[-2*k,7.4*k,0],.12*k,.12*k,'#738a6c',T);r.box(-2*k,7.3*k,0,.9*k,.22*k,.4*k,'#acb39a',T);}if(broken){r.box(-.8*k,.95*k,.7*k,.12,1.9*k,.12,'#74876b',T,.3);r.box(-.55*k,1.9*k,.7*k,.9*k,.85*k,.08,'#929c7c',T,.3);}}
 for(const pile of city.rubble){const random=seededRandom(pile.seed),T=frame(pile.x,pile.z,pile.yaw);for(let i=0;i<7;i++)r.box((random()-.5)*pile.size*2,.15+random()*.4,(random()-.5)*pile.size*1.5,.7+random()*pile.size,.25+random()*.5,.5+random()*pile.size,['#89957d','#6c8167','#a0a58b'][i%3],T,(random()-.5)*.6);}
 for(const fire of city.fires){const T=frame(fire.x,fire.z);r.box(0,.035,0,6*s,.025,4*s,'#354b36',T);r.box(-.7,.22,.2,2.3,.4,1.6,'#4b5e44',T,.08);}
}

// Sparse traces of abandonment are scenery only, capped independently of army size.
function abandonedCityDetails(r,city,frame){
 const s=city.scale,I=city.inner,random=seededRandom(r.battle.config.seed+730049);
 const B=r.transform({x:I+1.4*s,y:.15,z:-I+1.2*s,yaw:.17,roll:-1.13,pitch:0,scale:1,team:'dig'});
 // One burned-out bus lies on its side at an intersection, leaving the centre clear.
 r.box(0,1.2*s,0,10.8*s,2.4*s,2.7*s,'#64715c',B);r.box(0,2.45*s,0,10.5*s,.16*s,2.8*s,'#77816a',B);
 for(let i=0;i<5;i++)r.box((-3.8+i*1.85)*s,1.8*s,-1.38*s,1.45*s,.86*s,.06,'#253e30',B);
 for(const x of [-3.4,3.4])for(const z of [-1.5,1.5])r.box(x*s,.5*s,z*s,1.2*s,1.2*s,.3*s,'#293c2b',B);
 r.box(2.2*s,1.1*s,-1.41*s,4.7*s,1.6*s,.04,'#34472e',B);r.box(-3.6*s,.85*s,-1.42*s,2.6*s,.7*s,.04,'#795b3d',B);
 // Concrete roadblocks, a toppled sign, a deserted shelter and a few sandbags.
 for(let i=0;i<4;i++){const T=frame(I+(i-1.5)*2.8*s,-I-5.2*s,.12);r.box(0,.57*s,0,2.35*s,1.15*s,.85*s,'#91937a',T);r.box(0,1.02*s,0,2.1*s,.19*s,.52*s,'#aba98b',T);if(i%2===0)r.box(0,.62*s,-.45*s,1.5*s,.25*s,.04,'#6e684b',T);}
 for(let i=0;i<3;i++){const T=frame((i-1)*I,I+6.6*s,.3+i*.8);r.box(0,.18*s,0,4*s,.14*s,.15*s,'#6d8268',T);r.box(1.35*s,.24*s,0,1.4*s,.13*s,1.05*s,i===1?'#8c8770':'#6b8061',T);r.box(1.35*s,.32*s,0,.8*s,.025, .65*s,'#b2b397',T);}
 const shelter=frame(-I-7*s,I*.34,Math.PI/2);r.box(0,3*s,0,5.9*s,.2*s,2.8*s,'#71836a',shelter);for(const x of [-2.65,2.65])r.box(x*s,1.5*s,.8*s,.11*s,3*s,.11*s,'#506f50',shelter);r.box(.7*s,.75*s,.4*s,3.3*s,.2*s,.7*s,'#8e8b6b',shelter);r.box(-2*s,1.7*s,.88*s,.9*s,1.7*s,.06,'#b3b39a',shelter);
 for(let i=0;i<8;i++)r.box(-I-7*s+(i%4-1.5)*1.2*s,.24*s+Math.floor(i/4)*.43*s,I*.34+3*s,.95*s,.43*s,.68*s,i%2?'#8b8e65':'#7e865c',null,(i%3-1)*.06);
 // Asphalt cracks follow a few short broken seams beside aligned rubble piles.
 for(let cluster=0;cluster<4;cluster++){const side=cluster*Math.PI/2,T=frame(-Math.sin(side)*I+Math.cos(side)*I*.42,Math.cos(side)*I+Math.sin(side)*I*.42,side);
  const stain=[];for(let point=0;point<9;point++){const a=point/9*Math.PI*2,k=.7+random()*.3;stain.push(T(Math.cos(a)*3.6*s*k,.067,Math.sin(a)*1.6*s*k));}r.poly(stain,'#354834');
  for(let part=0;part<5;part++){const x=(-3+part*1.25)*s,z=Math.sin(part*1.7+cluster)*.8*s;r.poly([T(x,.075,z),T(x+1.4*s,.075,z+.5*s),T(x+1.4*s,.075,z+.68*s),T(x,.075,z+.12*s)],'#283f2b');}
 }
 const near=city.buildings.filter(v=>v.row===0);
 // Dusty weeds at the wall feet and a few isolated vines, rather than a jungle.
 for(let i=0;i<Math.min(16,near.length);i++){const v=near[i],T=frame(v.x,v.z,v.yaw),x=(i%2?.34:-.34)*v.w,z=-v.d/2-.45*s,h=(.5+random()*.55)*s;
  r.poly([T(x-.25*s,.24,z),T(x+.06*s,h+.24,z),T(x+.18*s,.24,z+.12*s)],'#697d51');r.poly([T(x-.08*s,.24,z),T(x+.44*s,h*.8+.24,z-.18*s),T(x+.26*s,.24,z+.2*s)],'#7a865b');
  if(i%4===0){r.box(x,.8*s,-v.d/2-.12,.4*s,1.4*s,.045,'#526e46',T);r.box(x+.2*s,2*s,-v.d/2-.13,.22*s,1.8*s,.045,'#5d754c',T);}
 }
 for(const v of near.filter(v=>v.type===0).slice(0,6)){const T=frame(v.x,v.z,v.yaw);r.box(-v.w*.23,1.75*s,-v.d/2-.25,v.w*.27,.22*s,.08,'#8d8160',T,.16);r.box(v.w*.15,3.5*s,-v.d/2-.22,v.w*.23,.5*s,.09,'#646e4f',T,-.14);}
}

// Static scenery only. This module never adds collision bodies or changes combat state.
export function constructionSite(r){
 const R=r.battle.radius,random=seededRandom(r.battle.config.seed+4931),growth=Math.max(1,R/36);
 const frame=(x,z,yaw=0)=>r.transform({x,y:0,z,yaw,roll:0,pitch:0,scale:1,team:'dig'});
 const patch=(x,z,rx,rz,color,n=9)=>{const points=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2,k=.78+random()*.3;points.push([x+Math.cos(a)*rx*k,.032,z+Math.sin(a)*rz*k]);}r.poly(points,color);};
 const strip=(a,b,width,color,y=.045)=>{const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz)||1,nx=-dz/length*width/2,nz=dx/length*width/2;r.poly([[a[0]+nx,y,a[1]+nz],[b[0]+nx,y,b[1]+nz],[b[0]-nx,y,b[1]-nz],[a[0]-nx,y,a[1]-nz]],color);};
 // Uneven compacted soil, dried mud and pale aggregate, rather than an even sand floor.
 for(let i=0;i<Math.min(300,Math.round(32*growth));i++)patch((random()-.5)*R*1.9,(random()-.5)*R*1.9,(1.5+random()*5)*Math.min(2.4,Math.sqrt(growth)),(1+random()*3)*Math.min(2.4,Math.sqrt(growth)),['#625f51','#716b58','#605e50','#79715e'][i%4]);
 for(const [sx,sz] of [[-1,-1],[1,1],[-1,1]]){patch(sx*R*.77,sz*R*.78,5.8,3.8,'#8e8b7b');patch(sx*R*.77+1,sz*R*.78,3.8,2.2,'#989585');}
 for(let i=0;i<Math.min(900,Math.floor(R*6));i++){
  const x=(random()-.5)*R*1.92,z=(random()-.5)*R*1.92,size=.06+random()*.2;
  r.box(x,.055,z,size*1.5,.08,size,['#9a9583','#6e6c5e','#aea58e'][i%3]);
 }
 // Paired crawler tracks with individual tread impressions along several work routes.
 const routes=[[[-R*.7,-R*.6],[R*.5,R*.35]],[[-R*.62,R*.55],[R*.68,R*.55]],[[R*.55,-R*.72],[R*.55,R*.1]]];
 for(const [a,b] of routes){const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),nx=-dz/length,nz=dx/length;
  for(const side of [-1,1]){const p=[a[0]+nx*side*1.15,a[1]+nz*side*1.15],q=[b[0]+nx*side*1.15,b[1]+nz*side*1.15];strip(p,q,.7,'#756b58');
   const count=Math.min(72,Math.floor(length/.9));for(let i=0;i<count;i++){const t=(i+.5)/count,x=p[0]+dx*t,z=p[1]+dz*t;strip([x-nx*.32,z-nz*.32],[x+nx*.32,z+nz*.32],.13,'#655e4e',.052);}
  }
 }
 // Larger yards gain gravel work pads, graded earth bays and crossing access routes.
 const tiles=Math.min(6,Math.max(1,Math.ceil((R-36)/40))),cell=R*1.7/tiles;
 if(tiles>1)for(let ix=0;ix<tiles;ix++)for(let iz=0;iz<tiles;iz++){
  if((ix+iz)%2)continue;const x=-R*.85+(ix+.5)*cell,z=-R*.85+(iz+.5)*cell,w=cell*.34,d=cell*.24;
  patch(x,z,w,d,(ix+iz)%4?'#8a826e':'#918e7e',10);patch(x+3,z-2,w*.64,d*.62,'#827d6c',8);
  for(let i=0;i<3;i++){const off=(i-1)*d*.55;strip([x-w*.8,z+off],[x+w*.8,z+off],.26,'#746e5d',.055);}
  if(ix%2===0)for(const side of [-1,1])strip([x+side*w,z-d],[x+side*w,z+d],.1,'#c2b9a0',.06);
 }
 if(tiles>1)for(let lane=1;lane<tiles;lane++){
  const z=-R*.85+lane*cell;strip([-R*.88,z],[R*.88,z],3.8,'#8a7d65',.035);
  for(const side of [-1,1])strip([-R*.88,z+side*1.1],[R*.88,z+side*1.1],.45,'#706854',.05);
 }
 // Survey chalk and a few shallow oil stains remain flat and do not obstruct movement.
 const markX=-R*.66,markZ=R*.24;
 for(const side of [-1,1]){strip([markX-4,markZ+side*4],[markX+4,markZ+side*4],.09,'#c2b9a0',.06);strip([markX+side*4,markZ-4],[markX+side*4,markZ+4],.09,'#c2b9a0',.06);}
 patch(R*.7,-R*.56,1.8,.9,'#625f50',8);patch(R*.69,-R*.57,.7,.45,'#55574c',7);

 // Roads and city blocks remain entirely outside the intact construction fence.
 apocalypseCity(r);
 // Impact scars are painted geometry: the fighting surface remains level.
 for(const site of ruinSites(r.battle)){
  const {x,z,radius:rad}=site,n=20,outer=[],inner=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2,k=.9+random()*.2;outer.push([x+Math.cos(a)*rad*k,.07,z+Math.sin(a)*rad*k]);inner.push([x+Math.cos(a)*rad*.67,.075,z+Math.sin(a)*rad*.67]);}
  patch(x,z,rad*1.5,rad*1.25,'#4b4b40',14);
  for(let i=0;i<n;i++){const j=(i+1)%n;r.poly([outer[i],outer[j],inner[j],inner[i]],i%3?'#6c6451':'#80715a');}
  patch(x,z,rad*.7,rad*.65,'#30382f',16);patch(x-.6,z+.4,rad*.36,rad*.32,'#262f29',12);
  for(let i=0;i<7;i++){const a=i/7*Math.PI*2+random()*.3,d=rad*(1.2+random()*.5);strip([x+Math.cos(a)*rad*.65,z+Math.sin(a)*rad*.65],[x+Math.cos(a)*d,z+Math.sin(a)*d],.12+random()*.18,'#3c4439',.083);}
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2,d=rad*(1.05+random()*.25);r.box(x+Math.cos(a)*d,.12,z+Math.sin(a)*d,.5+random()*.7,.18,.4+random()*.45,'#7b7968',null,(random()-.5)*.4);}
  r.oval(x+.6,.12,z-.3,rad*.17,.22,rad*.12,'#3b4036',(x,y,z)=>[x,y,z]);
 }
 // Ash streaks and fractured concrete at the edges leave the central fight readable.
 for(let i=0;i<Math.min(24,8+Math.floor(R/12));i++){
  const side=i%4,along=(random()-.5)*R*1.6,yaw=side*Math.PI/2,nx=-Math.sin(yaw),nz=Math.cos(yaw),tx=Math.cos(yaw),tz=Math.sin(yaw),x=nx*R*.82+tx*along,z=nz*R*.82+tz*along,T=frame(x,z,yaw);
  r.box(0,.12,0,2+random()*2,.23,1.1+random(),'#82806e',T,(random()-.5)*.25);r.beam([-1,.2,-.3],[1.5,.32,.1],.055,.06,'#4a5044',T);patch(x+1,z,2.6,1.3,'#4f5144',8);
 }
 // Burning drums and improvised barriers frame the arena without breaking its fence.
 for(const fire of fireSites(r.battle)){
  const T=frame(fire.x,fire.z);patch(fire.x,fire.z,3.5,2.6,'#343b31',10);
  for(const [x,z] of [[-.55,0],[.55,.25]]){r.box(x,.55,z,.8,1.1,.8,'#514a36',T);for(const y of [.15,.85])r.box(x,y,z,.86,.08,.86,'#30392e',T);r.box(x,1.12,z,.64,.05,.64,'#d0813e',T);}
  r.beam([-2.8,.3,-1.4],[-.9,1.1,-1.4],.32,.48,'#635541',T);r.beam([1.2,.3,1.3],[3.1,.9,1.3],.24,.38,'#766342',T);
 }
 for(const side of [-1,1]){
  const T=frame(side*R*.68,-R-4.2);for(const x of [-1.4,1.4])for(const z of [-1.2,1.2])r.box(x,3.2,z,.18,6.4,.18,'#515b48',T);
  r.box(0,5.2,0,3.5,.24,3.1,'#6a7056',T);r.box(0,7.2,0,3.9,.2,3.5,'#484f3e',T);for(const x of [-1.5,1.5])r.box(x,6.2,0,.14,1.9,.14,'#6d755b',T);
  r.box(0,6.1,-.8,.95,.6,.7,'#323c30',T);r.box(0,6.1,-1.2,.6,.28,.08,'#d3ac6a',T);r.box(1.35,7.55,0,.3,.45,.3,'#9f442d',T);
  for(let i=0;i<6;i++)r.box(-1.45,1+i*.65,-1.15,.1,.08,1.1,'#777b60',T);
 }
 // The ruined loading shelter is visible even on the smallest arena.
 const H=frame(R*.18,-R-6);for(const x of [-5,5])for(const z of [-2.3,2.3])r.box(x,2.3,z,.2,4.6,.2,'#424e3e',H);r.box(-2.8,3.5,0,5.6,.18,5.2,'#5c624b',H,.23);r.box(3,1,0,5.5,.18,4.5,'#484f3c',H,-.32);r.beam([-5,4.3,-2.3],[4,.25,2.3],.18,.2,'#7c6b47',H);for(let i=0;i<5;i++)r.box(-4+i*2,.2,2.8,1.3,.4,.8,'#777861',H,.15);
 // Burned vehicle chassis and collapsed steel lie outside the closed perimeter.
 const V=frame(R+5.5,R*.05,.18);r.box(0,.6,0,5.8,.65,2.6,'#353e32',V);r.box(-.9,1.2,0,2.7,.65,2.4,'#62614b',V,.08);r.box(-.8,1.8,0,2.4,.15,2.2,'#464c3a',V,.22);for(const x of [-1.8,1.8])for(const z of [-1.2,1.2])r.box(x,.4,z,.85,.8,.45,'#252f26',V);
 // Galvanized corrugated site hoarding. All supports and stock are outside the arena.
 const sections=Math.ceil(R*2/4.8),width=R*2/sections;
 for(let side=0;side<4;side++){
  const yaw=side*Math.PI/2,normal=[-Math.sin(yaw),Math.cos(yaw)],center=[normal[0]*(R+1),normal[1]*(R+1)],T=frame(center[0],center[1],yaw);
  for(let i=0;i<sections;i++){
   const x=-R+(i+.5)*width,pale=['#b8bfb7','#aeb8b1','#bdc3ba','#a6b2ae'][i%4];
   r.box(x,1.75,0,width-.05,2.5,.12,pale,T);
   r.box(x,.62,-.075,width-.05,.58,.07,'#526e72',T);
   for(const y of [.38,2.98])r.box(x,y,.13,width,.1,.13,'#697b78',T);
   for(let j=0;j<6;j++)r.box(x-width*.43+j*width*.17,1.75,-.09,.055,2.38,.055,j%2?'#c6cbc0':'#99a8a2',T);
   r.box(x-width/2,1.63,.08,.14,3.26,.18,'#556865',T);
   r.box(x-width/2,.14,.13,.65,.28,.65,'#8c8e80',T);
   if(i%2===0)r.limb([x-width/2,2.45,.15],[x-width/2,.2,1.5],.065,.065,'#5b6b65',T);
   if(i%7===3){r.box(x,1.6,-.1,1,.58,.04,'#c0a35b',T);for(let j=0;j<3;j++)r.box(x-.3+j*.3,1.6,-.14,.12,.5,.025,'#414940',T,-.3);}
   if(i%5===2){r.box(x+width*.25,.91,-.12,.07,.7,.02,'#8e7960',T);r.box(x-.4,1.25,-.115,.65,.9,.018,'#73796a',T);}
  }
  r.box(R,1.63,.08,.14,3.26,.18,'#556865',T);
 }
 // Closed double service gate with reinforced diagonals and a warning panel.
 const G=frame(0,-R-1.12,Math.PI);
 for(const side of [-1,1]){const x=side*2.5;r.box(x,1.65,0,4.9,2.7,.16,'#637d7e',G);for(const y of [.35,2.95])r.box(x,y,-.12,4.95,.13,.16,'#9ba9a1',G);r.box(side*4.95,1.7,-.08,.2,3.4,.25,'#4a615f',G);r.beam([side*.15,.45,-.17],[side*4.8,2.85,-.17],.12,.12,'#9da99d',G);}
 for(let i=0;i<8;i++)r.limb([-3.8+i*.95,1.45-Math.sin(i/8*Math.PI)*.45,-.3],[-2.85+i*.95,1.45-Math.sin((i+1)/8*Math.PI)*.45,-.3],.035,.035,'#303b30',G);
 r.box(0,1.6,-.21,1.5,.75,.04,'#c1a25c',G);for(let j=0;j<4;j++)r.box(-.5+j*.33,1.6,-.24,.15,.66,.025,'#39453e',G,-.3);

 const container=(x,z,yaw,color)=>{const T=frame(x,z,yaw);r.box(0,.18,0,10.5,.28,4.6,'#535a51',T);r.box(0,1.75,0,10.2,3,4.35,'#4c554a',T);r.box(0,3.3,0,10.5,.16,4.6,'#5e6556',T,.035);r.box(-2,1.7,-2.23,2.2,1.4,.05,'#303b32',T);r.box(1.1,2.2,-2.24,1.3,.55,.05,'#75705a',T);
  for(const side of [-1,1]){for(let i=0;i<17;i++)r.box(-4.8+i*.6,1.75,side*2.2,.1,2.8,.08,'#5b6758',T);for(const x of [-5.03,5.03])r.box(x,1.75,side*2.2,.16,3.05,.17,'#9aa59a',T);}
  for(const z of [-1.04,1.04]){r.box(5.15,1.75,z,.06,2.75,1.94,'#738981',T);r.box(5.22,1.75,z,.08,2.55,.055,'#adb3a4',T);r.box(5.28,1.45,z+.15,.08,.09,.4,'#414f48',T);}
 };
 container(-R*.53,-R-5.8,0,'#607c7b');container(R+6.3,-R*.43,Math.PI/2,'#777d71');
 // Stacked precast segments, timber pallets and pipes beside the perimeter.
 const S=frame(R*.52,-R-6.2);
 for(let row=0;row<3;row++)for(let i=0;i<4-row;i++)r.box(-3+i*1.7+row*.5,.35+row*.62,0,1.5,.57,2.2,'#a4a392',S);
 const P=frame(-R-5.6,R*.36,Math.PI/2);
 for(let layer=0;layer<3;layer++)for(let i=0;i<5;i++)r.box(0,.22+layer*.3,-1.3+i*.65,5.4,.2,.46,layer%2?'#8f7c5b':'#a18b64',P);
 for(let i=0;i<4;i++)r.limb([-3,.48+i*.04,3+i*.85],[3,.48+i*.04,3+i*.85],.39,.39,'#767d73',P);
 // Additional storage bays and site offices appear as the perimeter grows.
 
 /* Small yard clutter along the inner fence line; capped by arena size, never the army size, and kept clear of the central fight. */
 const clutterRandom=seededRandom(r.battle.config.seed^0x639a7);const clutter=Math.min(28,10+Math.floor(R/9));
 for(let i=0;i<clutter;i++){
  const side=i%4,yaw=side*Math.PI/2,nx=-Math.sin(yaw),nz=Math.cos(yaw),tx=Math.cos(yaw),tz=Math.sin(yaw),along=(clutterRandom()-.5)*R*1.5,depth=R*(.86+clutterRandom()*.07),x=nx*depth+tx*along,z=nz*depth+tz*along,T=frame(x,z,yaw+(clutterRandom()-.5)*.5),kind=i%7;
  if(kind===0){for(const k of [-.5,.5]){r.box(k,.03,0,.6,.06,.6,'#2f3236',T);r.box(k,.4,0,.4,.7,.4,'#d9772f',T);r.box(k,.45,0,.43,.12,.43,'#ece8de',T);}}
  else if(kind===1){for(let row=0;row<2;row++)for(let k=0;k<3-row;k++)r.box(-.6+k*.6+row*.3,.17+row*.3,0,.56,.3,.34,'#a69a76',T);}
  else if(kind===2){for(let k=0;k<6;k++)r.box(0,.08+(k%2)*.07,-.25+k*.1,3,.05,.05,'#6b4a3a',T);for(const k of [-.9,.9])r.box(k,.12,0,.12,.2,.75,'#c0a35b',T);}
  else if(kind===3){r.box(0,.45,0,1.2,.35,.75,'#566a4d',T,.15);r.box(.75,.3,0,.3,.3,.3,'#2b2e2c',T);for(const k of [-.3,.3])r.box(-.8,.5,k,.7,.06,.06,'#3a3d40',T);}
  else if(kind===4){for(const k of [-1.2,0,1.2])r.box(k,.45,0,.07,.9,.07,'#a58a5f',T);r.box(0,.75,0,2.5,.05,.02,'#d9542f',T);}
  else if(kind===5){const points=[];for(let k=0;k<8;k++){const a=k/8*Math.PI*2;points.push([x+Math.cos(a)*(1.2+clutterRandom()*.4),.05,z+Math.sin(a)*(.7+clutterRandom()*.3)]);}r.poly(points,'#4a5552');}
  else{r.box(0,.3,0,1,.6,.55,'#8c3b32',T);r.box(0,.62,0,1.02,.06,.57,'#5a2722',T);r.box(0,.68,0,.4,.05,.08,'#2c2c2c',T);}
 }
 const bays=Math.min(16,Math.floor((R-36)/12));
 for(let i=0;i<bays;i++){
  const side=i%4,along=(-.72+1.44*(Math.floor(i/4)+.5)/Math.ceil(bays/4))*R,yaw=side*Math.PI/2,nx=-Math.sin(yaw),nz=Math.cos(yaw),tx=Math.cos(yaw),tz=Math.sin(yaw),T=frame(nx*(R+7)+tx*along,nz*(R+7)+tz*along,yaw);
  if(i%3===0){container(nx*(R+6)+tx*along,nz*(R+6)+tz*along,yaw,i%2?'#6d7771':'#708282');if(R>130&&i%2===0){r.box(0,5,0,10,2.8,4.3,'#8e9890',T);r.box(0,6.45,0,10.3,.15,4.5,'#adb2a6',T);for(let window=-3;window<=3;window+=3)r.box(window,5.15,-2.18,1.4,1.1,.07,'#485f5c',T);}}
  else if(i%3===1){for(let layer=0;layer<3;layer++)for(let k=0;k<4;k++)r.box(-2.5+k*1.7,.3+layer*.58,0,1.5,.52,3,'#aaa797',T);for(let k=0;k<5;k++)r.limb([-3,.38,3+k*.65],[3,.38,3+k*.65],.28,.28,'#707b73',T);}
  else{for(let stack=0;stack<3;stack++)for(let k=0;k<5;k++)r.box(-3+stack*3,.2+k*.19,0,2.6,.16,3.5,'#958261',T);for(let k=0;k<5;k++)r.box(-3+k*1.3,.1,4,1.1,.18,2.4,'#72786a',T);}
 }
 if(R>90){
  // A perimeter tower crane and workshop give the large site a recognizable skyline.
  const T=frame(-R-13,-R*.72),height=R>160?27:20;
  for(const x of [-.8,.8])for(const z of [-.8,.8])r.box(x,height/2,z,.16,height,.16,'#aa8b48',T);
  for(let y=1;y<height;y+=3){for(const side of [-1,1]){r.beam([-.8,y,side*.8],[.8,y+2.5,side*.8],.1,.1,'#8d7846',T);r.box(0,y,side*.8,1.8,.11,.1,'#c4a258',T);}}
  r.box(0,height+.4,0,29,.65,1.5,'#b6954e',T);for(let x=-14;x<14;x+=2.2)r.beam([x,height+.6,-.7],[x+2.2,height+1.7,-.7],.1,.1,'#c3a45f',T);
  r.box(-10,height+.1,0,3.8,2.2,2.1,'#7f8172',T);r.box(2,height+.2,-.9,1.9,1.6,1.5,'#536c66',T);r.box(12,height-4.5,0,.045,9,.045,'#4c574e',T);r.box(12,height-9,0,.5,.65,.4,'#796b40',T);
  const W=frame(R+14,R*.65,Math.PI/2);for(const x of [-10,0,10])for(const z of [-4.5,4.5])r.box(x,2.5,z,.3,5,.3,'#505f51',W);r.box(-6,4.6,0,10,.22,10.6,'#747c69',W,.2);r.box(6,1,1,11,.22,9,'#626e5c',W,-.25);for(let i=0;i<5;i++){r.beam([-10+i*4,4.8,-4.5],[-6+i*4,.3,4.5],.16,.16,'#485744',W);r.box(-9+i*4.5,.28,-5.4,3,.5,2,'#777967',W,.2);}
 }

}
