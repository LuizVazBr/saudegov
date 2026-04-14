$path = "c:\Cliv\Backup outro notebook\cliv-telemedicina\anamnex-app\src\components\RealTimeDashboard.tsx"
$content = Get-Content $path -Raw

# 1. Update placeholder
$content = $content.Replace('placeholder="BUSCAR PACIENTE..."', 'placeholder={privacyMode ? "BUSCAR PROTOCOLO / ID..." : "BUSCAR PACIENTE..."}')

# 2. Update onNodeClick
$oldNodeClick = 'onNodeClick={(id) => {
                const t = triages.find(tri => tri.id === id);
                if (t) {
                  setSelectedTriage(t);
                  setMapFocus({ lat: t.latitude, lng: t.longitude, zoom: 17, ts: Date.now() });
                }
              }}'

$newNodeClick = 'onNodeClick={(id) => {
                const t = triages.find(tri => tri.id === id);
                if (t) {
                  setSelectedTriage(t);
                  setMapFocus({ lat: t.latitude, lng: t.longitude, zoom: 17, ts: Date.now() });
                } else {
                  const u = unidades.find(unit => unit.id === id);
                  if (u) setSelectedUnit(u);
                }
              }}'

$content = $content.Replace($oldNodeClick, $newNodeClick)

# 3. Add UnitDetailsModal function
$modalCode = '
function UnitDetailsModal({ unit, onClose }: { unit: Unit, onClose: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-[#0c0e14] rounded-[3rem] shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="relative h-64 bg-slate-200 dark:bg-white/5 overflow-hidden">
          {unit.imgUrl ? (
            <img src={unit.imgUrl} className="w-full h-full object-cover" alt={unit.nome} />
          ) : (
            <div className="w-full h-full flex items-center justify-center opacity-20">
              <Home size={80} />
            </div>
          )}
          <button onClick={onClose} className="absolute top-6 right-6 w-12 h-12 rounded-full bg-black/50 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/70 transition-all">
            <X size={24} />
          </button>
          <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 to-transparent">
             <h2 className="text-3xl font-black font-mono text-white uppercase tracking-tight">{unit.nome}</h2>
             <p className="text-white/60 text-sm font-mono flex items-center gap-2 mt-2">
               <MapPin size={16} /> {unit.endereco}
             </p>
          </div>
        </div>

        <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
           <div className="grid grid-cols-2 gap-6">
              <div className="bg-slate-50 dark:bg-white/5 p-6 rounded-3xl border border-slate-200 dark:border-white/10">
                 <p className="text-[10px] font-black font-mono opacity-40 uppercase tracking-widest mb-2">Previsão Demanda</p>
                 <div className="flex items-end gap-3">
                   <span className="text-4xl font-black font-mono text-[#0088ff] leading-none">{unit.totalTriagens}</span>
                   <span className="text-[11px] font-bold opacity-40 uppercase pb-1">Triagens</span>
                 </div>
              </div>
              <div className="bg-slate-50 dark:bg-white/5 p-6 rounded-3xl border border-slate-200 dark:border-white/10">
                 <p className="text-[10px] font-black font-mono opacity-40 uppercase tracking-widest mb-2">Índice Satisfação</p>
                 <div className="flex items-end gap-3">
                   <span className={`text-4xl font-black font-mono leading-none ${unit.satisfacao > 80 ? ''text-green-500'' : unit.satisfacao > 50 ? ''text-amber-500'' : ''text-red-500''}`}>
                     {unit.satisfacao}%
                   </span>
                   <div className="w-24 h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden mb-1.5 flex flex-col justify-center">
                      <div className={`h-full rounded-full transition-all duration-1000 ${unit.satisfacao > 80 ? ''bg-green-500'' : unit.satisfacao > 50 ? ''bg-amber-500'' : ''bg-red-500''}`} style={{ width: `${unit.satisfacao}%` }} />
                   </div>
                 </div>
              </div>
           </div>

           {unit.audioUrl && (
             <div className="bg-[#0088ff]/5 p-6 rounded-3xl border border-[#0088ff]/20">
                <p className="text-[10px] font-black font-mono text-[#0088ff] uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Mic size={14} /> Apresentação da Unidade
                </p>
                <audio controls className="w-full">
                  <source src={unit.audioUrl} type="audio/mpeg" />
                </audio>
             </div>
           )}

           <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { label: ''COORDS'', val: `${unit.lat.toFixed(4)}, ${unit.lng.toFixed(4)}` },
                { label: ''DEMORAS'', val: unit.delays },
                { label: ''RECLAMAÇÕES'', val: unit.complaints }
              ].map(s => (
                <div key={s.label} className="p-4 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                   <p className="text-lg font-black font-mono text-slate-800 dark:text-white leading-none mb-1">{s.val}</p>
                   <p className="text-[9px] font-black font-mono opacity-40 uppercase tracking-tighter">{s.label}</p>
                </div>
              ))}
           </div>
        </div>

        <div className="p-8 pt-0 flex gap-4">
           <button className="flex-1 py-4 rounded-2xl bg-[#0088ff] text-white text-[11px] font-black font-mono uppercase shadow-lg shadow-blue-500/20 tracking-widest hover:scale-[1.02] transition-all">
              Gestão de Fluxo
           </button>
           <button onClick={onClose} className="px-8 py-4 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/40 text-[11px] font-black font-mono uppercase border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 transition-all">
              Fechar
           </button>
        </div>
      </div>
    </motion.div>
  );
}
'

if ($content -notmatch "function UnitDetailsModal") {
    $content = $content.Replace("function TriageCard", $modalCode + "`nfunction TriageCard")
}

$content | Set-Content $path
