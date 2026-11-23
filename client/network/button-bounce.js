'use strict';
module.exports=function install(g,{clock=()=>typeof performance!=='undefined'&&typeof performance.now==='function'?performance.now():Date.now()}={}){
 if(g.buttonBounceBN)return g.buttonBounceBN;
 let regions=[],gesture=null,fx=null;
 const hit=(p,r)=>p&&p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h;
 const key=(b,label)=>[b.id||label,Math.round(b.x),Math.round(b.y),Math.round(b.w),Math.round(b.h)].join(':');
 const release=[.97,.985,1.015,1.04,1.055,1.05,1.035,1.015,1.003,.995,.997,1];
 const disabled=(enabled,label,color)=>enabled===false||enabled==null&&(/资源不足|不可升级|锁定|人口已满/.test(String(label))||/^#(?:555B60|546E7A)$/i.test(color));
 function scaleFor(k){if(!fx||fx.key!==k)return 1;if(fx.phase==='down')return fx.disabled?.98:.97;const i=Math.floor((clock()-fx.at)/25);if(i>=release.length){fx=null;return 1;}return fx.disabled?Math.min(1,Math.max(.98,release[i])):release[i];}
 function track(b,label,isDisabled,clip=null){const k=key(b,label),x=clip?Math.max(b.x,clip.x):b.x,y=clip?Math.max(b.y,clip.y):b.y,w=clip?Math.min(b.x+b.w,clip.x+clip.w)-x:b.w,h=clip?Math.min(b.y+b.h,clip.y+clip.h)-y:b.h;if(w>0&&h>0)regions.push({...b,x,y,w,h,key:k,disabled:isDisabled});return k;}
 function pose(b,s){return {...b,x:b.x+b.w*(1-s)/2,y:b.y+b.h*(1-s)/2,w:b.w*s,h:b.h*s};}
 const api={down(x,y){const r=[...regions].reverse().find(r=>hit({x,y},r));gesture=r||null;if(r)fx={key:r.key,disabled:r.disabled,phase:'down',at:clock()};},move(x,y){if(gesture&&!hit({x,y},gesture)){gesture=null;fx=null;}},end(wasTap){if(gesture&&wasTap)fx={key:gesture.key,disabled:gesture.disabled,phase:'release',at:clock()};else fx=null;gesture=null;},cancel(){gesture=null;fx=null;},debug:()=>({regions:regions.length,gesture:gesture?.key,phase:fx?.phase}),regions:()=>regions.map(r=>({...r})),pose(b,label,isDisabled=false,clipRect=null){const k=track(b,label,isDisabled,clipRect),s=scaleFor(k);return {...pose(b,s),fontSize:(b.fontSize||16)*s};}};
 api.needsFrame=()=>fx?.phase==='release';for(const name of ['down','move','end','cancel']){const native=api[name];api[name]=function(...args){const before=!!(fx||gesture),result=native.apply(this,args);if(before||fx||gesture)g.wxUiDirty=true;return result;};}
 const draw=g.draw;g.draw=function(...args){regions=[];const r=draw.apply(this,args);if(fx&&!regions.some(r=>r.key===fx.key))fx=null;return r;};
 const panel=g.drawPanelButton;g.drawPanelButton=function(b,label,color,font=16,enabled=null){const k=track(b,label,disabled(enabled,label,color)),s=scaleFor(k);return panel.call(this,pose(b,s),label,color,font*s,enabled);};
 const button=g.drawButton;g.drawButton=function(b){if(b._buttonCache411)return button.call(this,b);const k=track(b,b.text,b.disabled===true||!!(b.skillUI&&b.skillCooldown>0)),s=scaleFor(k);if(s===1)return button.call(this,b);const r=pose(b,s);const result=button.call(this,{...r,fontSize:(b.fontSize||16)*s,bounceScaleBN:s,_buttonCache411:true});if(!b.skillUI)this.drawPressedButton(r);return result;};
 return g.buttonBounceBN=api;
};
