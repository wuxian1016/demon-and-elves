'use strict';
// Combat alerts outrank economic suggestions. Native wording includes numbered walls.
function isCritical(text){const s=String(text||'');return /城墙.*(?:告急|残血|血量.*(?:低于|不足)|即将.*(?:倒塌|摧毁))/.test(s)||/(?:恶魔|恶龙|巨龙|烈焰龙|龙).*(?:撤退|逃跑|逃回|进攻|攻击你的防线|来袭|来了|出发)/.test(s)||/敌人即将.*来袭|敌人即将来袭/.test(s);}
function activeToast(g){return g.toast?.time>0&&isCritical(g.toast.text);}
function retreatActive(g){return ['prep','hunt'].includes(g.state)&&g.troll?.retreating===true&&!g.troll.dead&&!g.trollBase?.dead;}
function active(g){return activeToast(g)||retreatActive(g);}
function economy(g){return active(g)||g.wallHalfGuideDemo?.urgent?.()||g.wallHalfGuideDemo?.active()||!!g.baseUpgradeGuideBN;}
module.exports={isCritical,active,economy,activeToast,retreatActive};
