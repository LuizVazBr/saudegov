$path = "c:\Cliv\Backup outro notebook\cliv-telemedicina\anamnex-app\src\components\RealTimeDashboard.tsx"
$content = Get-Content $path -Raw

# Regex replace for onNodeClick block
$pattern = 'onNodeClick=\{\(id\) => \{[\s\S]+?\}\}'
$replacement = 'onNodeClick={(id) => {
               const t = triages.find(tri => tri.id === id);
               if (t) {
                 setSelectedTriage(t);
                 setMapFocus({ lat: t.latitude, lng: t.longitude, zoom: 17, ts: Date.now() });
               } else {
                 const u = unidades.find(unit => unit.id === id);
                 if (u) setSelectedUnit(u);
               }
             }}'

$content = [regex]::Replace($content, $pattern, $replacement)
$content | Set-Content $path
