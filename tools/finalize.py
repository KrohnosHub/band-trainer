# Vor jedem Release ausführen: CSP-Hashes der Inline-Skripte in index.html sowie VERSION und VENDOR_CACHE in sw.js aktualisieren.
import re,hashlib,base64,os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
s=open('index.html',encoding='utf8').read()
scripts=re.findall(r'<script>([\s\S]*?)</script>',s)
hs=["'sha256-"+base64.b64encode(hashlib.sha256(x.encode('utf8')).digest()).decode()+"'" for x in scripts]
m=re.search(r'(<meta http-equiv="Content-Security-Policy" content=")([^"]+)(")',s)
csp=m.group(2)
def fix(seg):
    seg=re.sub(r" 'sha256-[^']+'","",seg.group(0))
    return seg.rstrip(';')+' '+' '.join(hs)+';'
new=re.sub(r"script-src[^;]*;",fix,csp,count=1)
s=s[:m.start(2)]+new+s[m.end(2):]
open('index.html','w',encoding='utf8',newline='\n').write(s)
ver=re.search(r"APP_VERSION\s*=\s*'([^']+)'",s).group(1)
md5=hashlib.md5(open('index.html','rb').read()).hexdigest()[:8]
sw=open('sw.js',encoding='utf8').read()
sw=re.sub(r"(VERSION\s*=\s*')[^']+(')",lambda m:m.group(1)+ver+'-'+md5+m.group(2),sw,count=1)
# Vendor-Cache: Hash über Pfade+Bytes der vorab gespeicherten Dateien (ändert sich nur mit deren Inhalt)
files=re.findall(r'"([^"]+)"',re.search(r'PRECACHE_VENDOR\s*=\s*\[([\s\S]*?)\]',sw).group(1))
h=hashlib.md5()
for f in sorted(files):
    h.update(f.encode('utf8')); h.update(open(f,'rb').read())
sw=re.sub(r"(VENDOR_CACHE\s*=\s*'band-trainer-vendor-)[^']+(')",lambda m:m.group(1)+h.hexdigest()[:8]+m.group(2),sw,count=1)
open('sw.js','w',encoding='utf8',newline='\n').write(sw)
print(ver,md5,len(scripts),h.hexdigest()[:8])
