#!/usr/bin/env python3
"""Fetch the club PlayMetrics ICS feed and write events.json + events.js (offline snapshot).
Usage: python3 update-calendar.py   (stdlib only)"""
import json, re, urllib.request, datetime as dt
from zoneinfo import ZoneInfo
URL="https://calendar.playmetrics.com/calendars/c751/t550567/p0/t21294668/f/calendar.ics"
NY=ZoneInfo("America/New_York")
def parse(text):
    text=re.sub(r"\r?\n[ \t]","",text); out=[]
    for blk in text.split("BEGIN:VEVENT")[1:]:
        blk=blk.split("END:VEVENT")[0]; f={}
        for line in blk.splitlines():
            if ":" not in line: continue
            k,v=line.split(":",1); name=k.split(";")[0]; f[name]=(k,v)
        def t(n):
            if n not in f: return None
            k,v=f[n]; m=re.search(r"TZID=([^;:]+)",k)
            if len(v)==8: return dt.datetime.strptime(v,"%Y%m%d").replace(tzinfo=NY)
            d=dt.datetime.strptime(v.rstrip("Z"),"%Y%m%dT%H%M%S")
            tz=dt.timezone.utc if (v.endswith("Z") or (m and m.group(1)=="UTC")) else ZoneInfo(m.group(1) if m else "America/New_York")
            return d.replace(tzinfo=tz).astimezone(NY)
        s=f.get("SUMMARY",("",""))[1].replace("\\,",",").replace("\\n"," ")
        st,en=t("DTSTART"),t("DTEND")
        if not st: continue
        canceled=s.upper().startswith("CANCELED") or f.get("STATUS",("",""))[1]=="CANCELLED"
        low=s.lower(); typ="practice" if "practice" in low else "game" if re.search(r"game|match| vs\.? | @ |tournament|cup|league",low) else "event"
        title=re.sub(r"^CANCELED\s*","",s).split(" - ",1)[-1]
        d0=f.get("DESCRIPTION",("",""))[1].replace("\\,",",").replace("\\n"," ")
        if title.strip()=="Game" and " Arrive by" in d0:
            title=re.sub(r"SSA Swarm SCCL G2012/13 Marietta Elite-MW \(GA\)","Swarm",d0.split(" Arrive by")[0])
        out.append(dict(uid=f.get("UID",("",""))[1],date=st.strftime("%Y-%m-%d"),start=st.strftime("%H:%M"),end=en.strftime("%H:%M") if en else "",
          type=typ,title=title,location=f.get("LOCATION",("",""))[1].replace("\\,",","),desc=f.get("DESCRIPTION",("",""))[1].replace("\\,",",").replace("\\n"," "),canceled=canceled))
    return sorted(out,key=lambda e:(e["date"],e["start"]))
if __name__=="__main__":
    txt=urllib.request.urlopen(urllib.request.Request(URL,headers={"User-Agent":"Mozilla/5.0"}),timeout=30).read().decode("utf-8","replace")
    ev=parse(txt); snap=dict(source=URL,fetched=dt.datetime.now(NY).isoformat(timespec="minutes"),events=ev)
    json.dump(snap,open("events.json","w"),indent=1)
    open("events.js","w").write("window.CLUB_SNAPSHOT="+json.dumps(snap)+";\n")
    print(len(ev),"events written to events.json / events.js")
