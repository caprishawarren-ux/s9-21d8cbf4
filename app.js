(function(){
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const DOW=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const pd=s=>{const[a,b,c]=s.split("-").map(Number);return new Date(a,b-1,c)};
const fd=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const add=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const nice=d=>d.toLocaleDateString(undefined,{month:"short",day:"numeric"});
const fmtT=t=>{if(!t)return"";let[h,m]=t.split(":").map(Number);const ap=h>=12?"pm":"am";h=h%12||12;return h+(m?":"+String(m).padStart(2,"0"):"")+ap};
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const LS=(k,v)=>v===undefined?JSON.parse(localStorage.getItem(k)||"null"):localStorage.setItem(k,JSON.stringify(v));
const FEED="https://calendar.playmetrics.com/calendars/c751/t550567/p0/t21294668/f/calendar.ics";
const DEF={pdays:[1,3],pstart:"19:30",pend:"21:00",gday:6,stime:"16:30",project:true};
let S=Object.assign({},DEF,LS("jj_settings")||{});
let custom=LS("jj_events")||[];
let club=(window.CLUB_SNAPSHOT&&window.CLUB_SNAPSHOT.events)||[], clubSrc="snapshot "+((window.CLUB_SNAPSHOT||{}).fetched||"");
const TODAY=new Date();TODAY.setHours(0,0,0,0);

/* ---------- nav ---------- */
function show(id){$$(".page").forEach(p=>p.classList.toggle("active",p.id===id));$$("nav a").forEach(a=>a.classList.toggle("active",a.hash==="#"+id));window.scrollTo(0,0)}
window.addEventListener("hashchange",()=>show(location.hash.slice(1)||"home"));

/* ---------- countdown ---------- */
function tick(){const t=new Date(2027,4,15,8,0)-new Date();const v=t>0?[t/864e5,t/36e5%24,t/6e4%60,t/1e3%60].map(Math.floor):[0,0,0,0];
 $("#countdown").innerHTML=["Days","Hours","Min","Sec"].map((l,i)=>`<div><b>${v[i]}</b><small>${l}</small></div>`).join("")}
tick();setInterval(tick,1000);

/* ---------- ICS parse (live) ---------- */
function parseICS(txt){txt=txt.replace(/\r?\n[ \t]/g,"");const out=[];
 txt.split("BEGIN:VEVENT").slice(1).forEach(b=>{b=b.split("END:VEVENT")[0];const f={};
  b.split(/\r?\n/).forEach(l=>{const i=l.indexOf(":");if(i<0)return;const k=l.slice(0,i),n=k.split(";")[0];f[n]={k,v:l.slice(i+1)}});
  const t=n=>{if(!f[n])return null;const{k,v}=f[n];const m=v.match(/(\d{4})(\d\d)(\d\d)(?:T(\d\d)(\d\d)(\d\d))?/);if(!m)return null;
   if(!m[4])return new Date(+m[1],m[2]-1,+m[3]);
   if(/Z$/.test(v)||/TZID=UTC/.test(k))return new Date(Date.UTC(+m[1],m[2]-1,+m[3],+m[4],+m[5]));
   return new Date(+m[1],m[2]-1,+m[3],+m[4],+m[5])}; // assumes viewer in America/New_York
  const st=t("DTSTART"),en=t("DTEND");if(!st)return;const s=(f.SUMMARY||{v:""}).v.replace(/\\,/g,",");
  const desc=(f.DESCRIPTION||{v:""}).v.replace(/\\,/g,",").replace(/\\n/g," ");const lo=s.toLowerCase();
  let title=s.replace(/^CANCELED\s*/,"").split(" - ").pop();
  if(title.trim()==="Game"&&desc.includes(" Arrive by"))title=desc.split(" Arrive by")[0].replace("SSA Swarm SCCL G2012/13 Marietta Elite-MW (GA)","Swarm");
  const hm=d=>String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
  out.push({uid:(f.UID||{}).v,date:fd(st),start:hm(st),end:en?hm(en):"",type:lo.includes("practice")?"practice":/game|match|tournament|cup/.test(lo)?"game":"event",
   title,location:(f.LOCATION||{v:""}).v.replace(/\\,/g,","),desc,canceled:/^CANCELED/i.test(s)||(f.STATUS||{}).v==="CANCELLED"})});
 return out.sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start))}
async function live(){try{const r=await fetch(FEED,{cache:"no-store"});if(!r.ok)throw 0;const ev=parseICS(await r.text());if(ev.length){club=ev;clubSrc="live feed ("+new Date().toLocaleString()+")";renderAll()}}catch(e){/* CORS/offline -> keep snapshot */}}

/* ---------- schedule logic ---------- */
const lastFeedPractice=()=>club.filter(e=>e.type==="practice"&&!e.canceled).map(e=>e.date).sort().pop()||"2000-01-01";
function eventsOn(ds){const d=pd(ds),out=[];
 club.filter(e=>e.date===ds).forEach(e=>out.push({...e,src:"club"}));
 if(S.project&&ds>lastFeedPractice()&&S.pdays.includes(d.getDay())&&ds<=TRYOUT&&!club.some(e=>e.date===ds&&e.type==="practice"))
  out.push({date:ds,start:S.pstart,end:S.pend,type:"practice",title:"Club practice (projected)",projected:true});
 custom.filter(e=>e.date===ds).forEach(e=>out.push({...e,src:"custom"}));
 return out.sort((a,b)=>(a.start||"").localeCompare(b.start||""))}
const busy=ds=>eventsOn(ds).some(e=>!e.canceled&&(e.type==="practice"||e.type==="game"));
const gameOn=ds=>eventsOn(ds).some(e=>!e.canceled&&e.type==="game")||(S.gday>=0&&pd(ds).getDay()==S.gday&&ds>lastFeedPractice()&&S.project);
function phaseOf(ds){return PHASES.find(p=>ds>=p.start&&ds<=p.end)||PHASES[PHASES.length-1]}
let WEEKS=[];
function buildPlan(){WEEKS=[];let w=pd(PLAN_START),n=1;const cnt={};
 while(fd(w)<=TRYOUT){const ws=fd(w),ph=phaseOf(ws);cnt[ph.id]=(cnt[ph.id]||0)+1;const pi=cnt[ph.id];
  const lastWk=fd(add(w,6))>=TRYOUT, holiday=ws==="2026-12-21"||ws==="2026-12-28";
  const deload=ph.id!=="peak"&&pi%4===0;
  let tpl=SESSIONS[ph.id].slice(), N=tpl.length;
  if(deload||holiday)N=Math.min(N,3); if(lastWk)N=2;
  const days=[...Array(7)].map((_,i)=>fd(add(w,i))).filter(d=>d<=TRYOUT);
  let free=days.filter(d=>!busy(d)&&d!==TRYOUT&&!(lastWk&&d>=fd(add(pd(TRYOUT),-1)))&&d>=fd(TODAY));
  const pre=d=>gameOn(fd(add(pd(d),1)));
  const order=free.filter(d=>!gameOn(d)&&!pre(d)).concat(free.filter(d=>!gameOn(d)&&pre(d)));
  N=Math.min(N,Math.max(order.length-1,order.length?1:0)); // keep >=1 rest day
  // spread: pick evenly across available days
  let pick=[];if(N>0){const step=order.length/N;const sorted=order.slice().sort();
   for(let i=0;i<N;i++)pick.push(sorted[Math.floor(i*step)]);pick=[...new Set(pick)]}
  if(lastWk)tpl=[SESSIONS.peak[1],SESSIONS.peak[0]];
  const sess=pick.sort().map((d,i)=>{const t=tpl[i%tpl.length];return{date:d,...t,min:Math.round(t.min*(deload||lastWk?0.75:1)),light:pre(d)}});
  WEEKS.push({n:n++,start:ws,phase:ph,pi,deload,holiday,lastWk,days,sess});w=add(w,7)}}
const soloOn=ds=>{for(const w of WEEKS)for(const s of w.sess)if(s.date===ds)return s;return null};
const drillName=id=>(DRILLS.find(d=>d.id===id)||{}).name||id;

/* ---------- plan render ---------- */
function dayCell(ds){const d=pd(ds),ev=eventsOn(ds).filter(e=>!e.canceled),s=soloOn(ds);
 let h=`<div class="day ${!s&&!ev.length?"rest":""}"><b>${DOW[d.getDay()]} ${nice(d)}</b>`;
 ev.forEach(e=>h+=`<div class="ev e-${e.type}">${e.type==="game"?"⚽ ":""}${esc(e.title)} ${fmtT(e.start)}</div>`);
 if(ds===TRYOUT)h+=`<div class="ev e-tryout">🏆 ECNL TRYOUT</div>`;
 if(s)h+=`<div class="ev e-solo">${esc(s.t)} · ${s.min}m${s.light?" (keep light)":""}</div><small>${s.d.map(drillName).join(" → ")}</small>`;
 else if(!ev.length&&ds!==TRYOUT)h+=`<div class="ev e-rest">Rest / recovery</div>`;
 return h+"</div>"}
function renderPlan(){const cur=fd(TODAY);
 $("#weeks").innerHTML=WEEKS.map(w=>`<details class="week ${cur>=w.start&&cur<=fd(add(pd(w.start),6))?"current":""}" ${cur>=w.start&&cur<=fd(add(pd(w.start),6))?"open":""}>
 <summary><span class="p ${w.phase.id}">${w.phase.name}</span> Week ${w.n} · ${nice(pd(w.start))}${w.deload?" · 🔋 Deload":""}${w.holiday?" · 🎄 Holiday (lighter)":""}${w.lastWk?" · 🏆 TRYOUT WEEK – Taper":""} <span style="margin-left:auto;color:var(--mut);font-weight:400">${w.sess.length} solo</span></summary>
 <div class="wk-body"><p class="note">${w.phase.goal}${w.deload?" <b>Deload week:</b> cut the volume about 25% and focus on quality.":""}</p><div class="days">${w.days.map(dayCell).join("")}</div>
 ${w.sess.length?"<p><b>Session notes:</b> "+w.sess.map(s=>esc(s.t)+": "+esc(s.note)).join(" | ")+"</p>":""}</div></details>`).join("");
 const tw=WEEKS.find(w=>cur>=w.start&&cur<=fd(add(pd(w.start),6)));
 $("#thisweek").innerHTML=tw?`<p><span class="p ${tw.phase.id}">${tw.phase.name}</span> Week ${tw.n}</p><ul>${tw.sess.map(s=>`<li>${DOW[pd(s.date).getDay()]}: ${esc(s.t)} (${s.min} min)</li>`).join("")}</ul>`:`<p>The plan starts the <b>week of Oct 26, 2026</b>. Until then, she can do the FIFA 11+ warm-up and get used to the drill library.</p>`}

/* ---------- drills ---------- */
let cat="All";
function renderDrills(){const cats=["All",...new Set(DRILLS.map(d=>d.cat))];
 $("#filters").innerHTML=cats.map(c=>`<button class="${c===cat?"on":""}" data-c="${c}">${c}</button>`).join("");
 $$("#filters button").forEach(b=>b.onclick=()=>{cat=b.dataset.c;renderDrills()});
 $("#drilllist").innerHTML=DRILLS.filter(d=>cat==="All"||d.cat===cat).map(d=>`<div class="card drill" id="d-${d.id}"><span class="tag">${d.cat}</span><h3>${d.name}</h3><dl>
 <dt>Setup</dt><dd>${d.setup}</dd><dt>Equipment</dt><dd>${d.equip}</dd><dt>Reps</dt><dd>${d.reps}</dd>
 <dt>Coaching points</dt><dd><ul>${d.points.map(p=>`<li>${p}</li>`).join("")}</ul></dd><dt>Progression</dt><dd>${d.prog}</dd></dl></div>`).join("")}

/* ---------- tryout ---------- */
function renderTryout(){const T=TRYOUT_INFO,ck=LS("jj_check")||{};
 $("#tryoutcontent").innerHTML=`<div class="cards"><div class="card"><h3>👀 What Coaches Look For</h3><ul>${T.look.map(x=>`<li>${x}</li>`).join("")}</ul><p class="note">ECNL is the top girls' club league. Each club runs its own tryout format and has its own roster needs. Confirm the details with the club directly.</p></div>
 <div class="card"><h3>🧠 Mental Prep</h3><ul>${T.mental.map(x=>`<li>${x}</li>`).join("")}</ul></div></div>
 <div class="cards"><div class="card"><h3>✅ Tryout-Week Checklist</h3><ul class="check">${T.checklist.map((x,i)=>`<li><label style="flex-direction:row;gap:.5rem;color:var(--txt)"><input type="checkbox" data-i="${i}" ${ck[i]?"checked":""}> ${x}</label></li>`).join("")}</ul></div>
 <div class="card"><h3>🎬 Highlight Reel Tips</h3><ul>${T.video.map(x=>`<li>${x}</li>`).join("")}</ul></div></div>`;
 $$("#tryoutcontent input[type=checkbox]").forEach(c=>c.onchange=()=>{ck[c.dataset.i]=c.checked;LS("jj_check",ck)})}

/* ---------- calendar ---------- */
let view="month",cur=new Date(Math.max(TODAY,pd("2026-10-01")));
const MIN=pd("2026-10-01"),MAX=pd(TRYOUT);
function cellHTML(ds,out){const d=pd(ds),ev=eventsOn(ds),s=soloOn(ds);
 let h=`<div class="cell ${out?"out":""} ${ds===fd(TODAY)?"today":""}"><span class="n">${view==="week"?DOW[d.getDay()]+" "+nice(d):d.getDate()}</span>`;
 ev.forEach(e=>h+=`<div class="ev e-${e.type}" title="${esc(e.title+" "+(e.location||""))}" ${e.canceled?'style="text-decoration:line-through;opacity:.5"':''}>${fmtT(e.start)} ${esc(e.title)}${view==="week"&&e.location?" · "+esc(e.location):""}</div>`);
 if(s)h+=`<div class="ev e-solo">${S.stime?fmtT(S.stime)+" ":""}${esc(s.t)}${view==="week"?" ("+s.min+" min): "+s.d.map(drillName).join(", "):""}</div>`;
 if(ds===TRYOUT)h+=`<div class="ev e-tryout">🏆 ECNL Tryout</div>`;
 if(!s&&!ev.filter(e=>!e.canceled).length&&ds>=PLAN_START&&ds<TRYOUT)h+=`<div class="ev e-rest">Rest</div>`;
 return h+"</div>"}
function renderCal(){let h="";
 if(view==="month"){const y=cur.getFullYear(),m=cur.getMonth(),first=new Date(y,m,1),st=add(first,-first.getDay());
  $("#calTitle").textContent=first.toLocaleDateString(undefined,{month:"long",year:"numeric"});
  h=`<div class="cal">${DOW.map(d=>`<div class="h">${d}</div>`).join("")}`;
  for(let i=0;i<42;i++){const d=add(st,i);if(i===35&&d.getMonth()!==m)break;h+=cellHTML(fd(d),d.getMonth()!==m)}h+="</div>"}
 else{const st=add(cur,-cur.getDay());$("#calTitle").textContent="Week of "+nice(st)+", "+st.getFullYear();
  h=`<div class="weekv">${[...Array(7)].map((_,i)=>cellHTML(fd(add(st,i)),false)).join("")}</div>`}
 $("#calgrid").innerHTML=h+`<p class="note">Club events come from the ${esc(clubSrc)}. The feed currently lists practices through ${nice(pd(lastFeedPractice()))}. ${S.project?"After that, practices are projected from Settings (marked 'projected').":""} To refresh the bundled snapshot, run <code>python3 update-calendar.py</code>.</p>`;
 $("#viewMonth").classList.toggle("on",view==="month");$("#viewWeek").classList.toggle("on",view==="week")}
function move(dir){if(view==="month")cur=new Date(cur.getFullYear(),cur.getMonth()+dir,1);else cur=add(cur,7*dir);
 if(cur<MIN)cur=new Date(MIN);if(cur>MAX)cur=new Date(MAX);renderCal()}
$("#prev").onclick=()=>move(-1);$("#next").onclick=()=>move(1);
$("#viewMonth").onclick=()=>{view="month";renderCal()};$("#viewWeek").onclick=()=>{view="week";renderCal()};
$("#today").onclick=()=>{cur=new Date(Math.max(TODAY,MIN));renderCal()};

function renderSettings(){const f=$("#settings");
 $("#pdays").innerHTML="<span style='width:100%;color:var(--mut);font-size:.85rem'>Practice days</span>"+DOW.map((d,i)=>`<label><input type="checkbox" value="${i}" ${S.pdays.includes(i)?"checked":""}>${d}</label>`).join("")+
 `<label style="width:100%"><input type="checkbox" name="project" ${S.project?"checked":""}> Project weekly practices after the feed ends</label>`;
 f.pstart.value=S.pstart;f.pend.value=S.pend;f.gday.value=S.gday;f.stime.value=S.stime}
$("#settings").onsubmit=e=>{e.preventDefault();const f=e.target;
 S={pdays:$$("#pdays input[value]").filter(c=>c.checked).map(c=>+c.value),pstart:f.pstart.value,pend:f.pend.value,gday:+f.gday.value,stime:f.stime.value,project:f.project.checked};
 LS("jj_settings",S);renderAll();alert("Settings saved. The plan has been rescheduled.")};
function renderEvList(){$("#evlist").innerHTML=custom.length?"<table>"+custom.map((e,i)=>`<tr><td>${e.date}</td><td>${fmtT(e.time)}</td><td>${esc(e.title)}</td><td><button class="ghost danger" data-i="${i}">✕</button></td></tr>`).join("")+"</table>":"";
 $$("#evlist button").forEach(b=>b.onclick=()=>{custom.splice(b.dataset.i,1);LS("jj_events",custom);renderAll()})}
$("#evform").onsubmit=e=>{e.preventDefault();const f=e.target;custom.push({date:f.date.value,start:f.time.value,time:f.time.value,type:f.type.value,title:f.title.value});
 custom.sort((a,b)=>a.date.localeCompare(b.date));LS("jj_events",custom);f.reset();renderAll()};

/* ---------- ICS export ---------- */
$("#ics").onclick=()=>{const st=(S.stime||"16:30").replace(":",""),stamp=new Date().toISOString().replace(/[-:]|\.\d+/g,"");
 const L=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Jaylin Striker Plan//EN","CALSCALE:GREGORIAN","X-WR-CALNAME:Jaylin Solo Training","X-WR-TIMEZONE:America/New_York"];
 const icsEsc=s=>String(s).replace(/[\\,;]/g,m=>"\\"+m).replace(/\n/g,"\\n");
 WEEKS.forEach(w=>w.sess.forEach((s,i)=>{const d=s.date.replace(/-/g,"");const[h,m]=(S.stime||"16:30").split(":").map(Number);const e=new Date(2000,0,1,h,m+s.min);
  const et=String(e.getHours()).padStart(2,"0")+String(e.getMinutes()).padStart(2,"0");
  L.push("BEGIN:VEVENT","UID:jaylin-"+d+"-"+i+"@striker-plan","DTSTAMP:"+stamp,"DTSTART;TZID=America/New_York:"+d+"T"+st+"00","DTEND;TZID=America/New_York:"+d+"T"+et+"00",
   "SUMMARY:"+icsEsc("⚽ "+s.t+" ("+w.phase.name+" wk "+w.n+")"),"DESCRIPTION:"+icsEsc(s.d.map(drillName).join(" → ")+"\n"+s.note),"END:VEVENT")}));
 custom.forEach((e,i)=>{const d=e.date.replace(/-/g,"");L.push("BEGIN:VEVENT","UID:jaylin-custom-"+i+"-"+d+"@striker-plan","DTSTAMP:"+stamp,
  e.time?"DTSTART;TZID=America/New_York:"+d+"T"+e.time.replace(":","")+"00":"DTSTART;VALUE=DATE:"+d,"SUMMARY:"+icsEsc(e.title),"END:VEVENT")});
 L.push("BEGIN:VEVENT","UID:jaylin-tryout-20270515@striker-plan","DTSTAMP:"+stamp,"DTSTART;VALUE=DATE:20270515","DTEND;VALUE=DATE:20270516","SUMMARY:🏆 ECNL Tryout","END:VEVENT","END:VCALENDAR");
 const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([L.join("\r\n")],{type:"text/calendar"}));a.download="jaylin-training-plan.ics";a.click()};

/* ---------- tracker ---------- */
let logs=LS("jj_logs")||[];
function renderTracker(){const tests=logs.filter(l=>l.shots>0),sp=logs.filter(l=>l.sprint>0).sort((a,b)=>a.date.localeCompare(b.date));
 const pct=tests.length?Math.round(tests.reduce((a,l)=>a+ +l.goals,0)/tests.reduce((a,l)=>a+ +l.shots,0)*100)+"%":"–";
 const wk=logs.filter(l=>pd(l.date)>=add(TODAY,-7)).length;
 $("#stats").innerHTML=[["Sessions logged",logs.length],["Last 7 days",wk],["Total minutes",logs.reduce((a,l)=>a+(+l.minutes||0),0)],["Finishing %",pct],["Best 20 m",sp.length?Math.min(...sp.map(l=>+l.sprint)).toFixed(2)+"s":"–"]]
  .map(([k,v])=>`<div class="stat"><b>${v}</b>${k}</div>`).join("");
 $("#history").innerHTML=logs.length?"<table><tr><th>Date</th><th>Type</th><th>Min</th><th>Goals</th><th>20 m</th><th>Feel</th><th>Notes</th><th></th></tr>"+logs.map((l,i)=>`<tr><td>${l.date}</td><td>${esc(l.type)}</td><td>${l.minutes||""}</td><td>${l.shots?l.goals+"/"+l.shots:""}</td><td>${l.sprint||""}</td><td>${l.rpe||""}</td><td>${esc(l.notes)}</td><td><button class="ghost danger" data-i="${i}">✕</button></td></tr>`).join("")+"</table>":"<p>No sessions logged yet.</p>";
 $$("#history button[data-i]").forEach(b=>b.onclick=()=>{logs.splice(b.dataset.i,1);LS("jj_logs",logs);renderTracker()});
 const c=$("#chart"),x=c.getContext("2d"),W=c.width=c.clientWidth||600,H=c.height=160;x.clearRect(0,0,W,H);x.fillStyle="#9fb0d0";x.font="12px sans-serif";
 if(sp.length<1){x.fillText("Log 20 m sprint times to see her trend",10,80);return}
 const v=sp.map(l=>+l.sprint),mn=Math.min(...v)-.1,mx=Math.max(...v)+.1,X=i=>30+i*(W-50)/Math.max(1,v.length-1),Y=t=>15+(t-mn)/(mx-mn)*(H-35);
 x.strokeStyle="#20d3a5";x.lineWidth=3;x.beginPath();v.forEach((t,i)=>i?x.lineTo(X(i),Y(t)):x.moveTo(X(i),Y(t)));x.stroke();
 v.forEach((t,i)=>{x.fillStyle="#ff3d7f";x.beginPath();x.arc(X(i),Y(t),4,0,7);x.fill();x.fillStyle="#e8eefc";x.fillText(t.toFixed(2),X(i)-12,Y(t)-8)});
 x.fillStyle="#9fb0d0";x.fillText("lower = faster",W-90,H-5)}
$("#logform").date.value=fd(TODAY);
$("#logform").onsubmit=e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.target));logs.push(o);logs.sort((a,b)=>b.date.localeCompare(a.date));LS("jj_logs",logs);e.target.reset();e.target.date.value=fd(TODAY);renderTracker()};
$("#clear").onclick=()=>{if(confirm("Delete all logged sessions?")){logs=[];LS("jj_logs",logs);renderTracker()}};
$("#export").onclick=()=>{const k=["date","type","minutes","goals","shots","sprint","rpe","notes"];const csv=[k.join(",")].concat(logs.map(l=>k.map(c=>'"'+String(l[c]??"").replace(/"/g,'""')+'"').join(","))).join("\n");
 const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="jaylin-progress.csv";a.click()};

function renderAll(){buildPlan();renderPlan();renderCal();renderEvList()}
renderSettings();renderAll();renderDrills();renderTryout();renderTracker();show(location.hash.slice(1)||"home");live();
window.addEventListener("resize",renderTracker);
})();
