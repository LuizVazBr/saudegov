$path = "c:\Cliv\Backup outro notebook\cliv-telemedicina\anamnex-app\src\components\RealTimeDashboard.tsx"
$content = Get-Content $path -Raw

# Helper to escape regex special chars
function Escape-Regex {
    param([string]$str)
    return [Regex]::Escape($str)
}

# 1. Update states
$oldState = 'const [feedTriages, setFeedTriages] = useState<TriageEvent[]>([]); const [mapTriages, setMapTriages] = useState<TriageEvent[]>([]);
  const [unidadesRaw, setUnidadesRaw] = useState<any[]>([]);'

$newState = 'const [feedTriages, setFeedTriages] = useState<TriageEvent[]>([]);
  const [mapTriages, setMapTriages] = useState<TriageEvent[]>([]);
  const [unidadesRaw, setUnidadesRaw] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mapBounds, setMapBounds] = useState<any>(null);
  const loaderRef = useRef<HTMLDivElement>(null);'

$content = $content.Replace($oldState, $newState)

# 2. Main logic overhaul
$oldEffectBlock = 'useEffect(() => {
    setMounted(true)
    const clockInterval = setInterval(() => setTime(fmtTime()), 1000);

    fetch("/api/historico-all?limit=50")'

# I'll use a larger block for matching
$patternHeader = '  useEffect\(\(\) => \{\r?\n\s+setMounted\(true\)\r?\n\s+const clockInterval = setInterval\(\(\) => setTime\(fmtTime\(\)\), 1000\);\r?\n\r?\n\s+fetch\(\"/api/historico-all\?limit=50\"\)'

# Actually, I'll just find the start of the useEffect and replace until the end of the fetch block
# or use simpler anchors.

$newLogic = '
  // FETCH FEED (Infinite Scroll)
  const fetchFeed = useCallback(async (pageNum: number, isNewSearch: boolean = false) => {
    if (loadingMore || (!hasMore && !isNewSearch)) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/historico-all?page=${pageNum}&limit=20&search=${search}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        if (data.length < 20) setHasMore(false);
        const formatted = data.map((t: any) => ({
          ...t,
          id: String(t.id),
          latitude: typeof t.latitude === ''string'' ? parseFloat(t.latitude) : t.latitude,
          longitude: typeof t.longitude === ''string'' ? parseFloat(t.longitude) : t.longitude,
          dataHora: t.data_cadastro
        }));
        setFeedTriages(prev => isNewSearch ? formatted : [...prev, ...formatted]);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [search, loadingMore, hasMore]);

  // FETCH MAP DATA (Geospatial)
  useEffect(() => {
    if (!mapBounds) return;
    const b = mapBounds;
    fetch(`/api/historico-all?minLat=${b.getSouth()}&maxLat=${b.getNorth()}&minLng=${b.getWest()}&maxLng=${b.getEast()}&limit=200`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const formatted = data.map((t: any) => ({
            ...t,
            id: String(t.id),
            latitude: typeof t.latitude === ''string'' ? parseFloat(t.latitude) : t.latitude,
            longitude: typeof t.longitude === ''string'' ? parseFloat(t.longitude) : t.longitude,
            dataHora: t.data_cadastro
          }));
          setMapTriages(formatted);
        }
      });
  }, [mapBounds]);

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        setPage(prev => {
          const next = prev + 1;
          fetchFeed(next);
          return next;
        });
      }
    }, { threshold: 0.1 });

    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, fetchFeed]);

  useEffect(() => {
    setMounted(true);
    const clockInterval = setInterval(() => setTime(fmtTime()), 1000);

    fetch("/api/unidades")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setUnidadesRaw(data);
      });

    // Reset and Initial Load of Feed
    setPage(1);
    setHasMore(true);
    fetchFeed(1, true);

    const eventSource = new EventSource("/api/real-time/stream");
    eventSource.onmessage = (event) => {
      const newTriage = JSON.parse(event.data);
      if (newTriage.latitude && newTriage.longitude) {
        const triage: TriageEvent = {
          id: newTriage.id ? String(newTriage.id) : Math.random().toString(),
          pacienteId: String(newTriage.pacienteId || ""),
          paciente_nome: newTriage.paciente_nome,
          descricao: newTriage.descricao,
          classificacao: newTriage.classificacao || "Verde",
          sintomas: newTriage.sintomas || [],
          latitude: newTriage.latitude,
          longitude: newTriage.longitude,
          dataHora: new Date().toISOString(),
          isNew: true
        };
        
        setFeedTriages(prev => [triage, ...prev]);
        setMapTriages(prev => [triage, ...prev]);
        setMapFocus({ lat: triage.latitude, lng: triage.longitude, zoom: 17, ts: Date.now() });
        
        toast.success(`NOVA TRIAGEM: ${maskName(triage.paciente_nome)}`, {
           style: { background: ''#02040a'', color: ''#fff'', border: ''1px solid #0088ff'', fontSize: ''12px'', fontWeight: ''bold'' }
        });
      }
    };

    return () => { clearInterval(clockInterval); eventSource.close(); };
  }, [search]);
'

# Find the old useEffect block and replace until the end of its cleanup
$effectRegex = '  useEffect\(\(\) => \{[\s\S]+?return \(\) => \{ clearInterval\(clockInterval\); eventSource.close\(\); \};\r?\n\s+\}, \[\]\);'
$content = [regex]::Replace($content, $effectRegex, $newLogic)

# 3. Final cleanup of triages references
$content = $content.Replace('{filteredTriages.map(t => (', '{feedTriages.map(t => (')
$content = $content.Replace('triages={triages}', 'triages={mapTriages}')
$content = $content.Replace('const t = triages.find(tri => tri.id === id);', 'const t = [...feedTriages, ...mapTriages].find(tri => tri.id === id);')

# 4. Insert loader and bounds handler
if ($content -notmatch "loaderRef") {
  $content = $content.Replace('))}
           </div>', '))}
                {hasMore && (
                  <div ref={loaderRef} className="py-10 flex justify-center">
                    <Loader2 className="animate-spin text-[#0088ff]" size={24} />
                  </div>
                )}
                {!hasMore && feedTriages.length > 0 && (
                  <div className="py-10 text-center text-[10px] font-black font-mono opacity-30 uppercase tracking-[0.3em]">
                    Sem mais resultados
                  </div>
                )}
           </div>')
}

$content = $content.Replace('onNodeClick={onNodeClick}', 'onBoundsChange={(b) => setMapBounds(b)} onNodeClick={onNodeClick}')

$content | Set-Content $path -Encoding UTF8
