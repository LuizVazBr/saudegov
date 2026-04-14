$path = "c:\Cliv\Backup outro notebook\cliv-telemedicina\anamnex-app\src\components\RealTimeDashboard.tsx"
$content = Get-Content $path -Raw

# 1. Update State Variables
$oldState = '  const [triages, setTriages] = useState<TriageEvent[]>([]);
  const [unidadesRaw, setUnidadesRaw] = useState<any[]>([]);'

$newState = '  const [feedTriages, setFeedTriages] = useState<TriageEvent[]>([]);
  const [mapTriages, setMapTriages] = useState<TriageEvent[]>([]);
  const [unidadesRaw, setUnidadesRaw] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mapBounds, setMapBounds] = useState<any>(null);
  const loaderRef = useRef<HTMLDivElement>(null);'

$content = $content.Replace($oldState, $newState)

# 2. Update initial fetch & Map Fetch (replace the old fetch block)
$oldFetch = '  useEffect(() => {
    fetch("/api/historico-all?limit=50")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setTriages(data);
      });'

$newFetch = '  // FETCH FEED (Infinite Scroll)
  const fetchFeed = useCallback(async (pageNum: number, isNewSearch: boolean = false) => {
    if (loadingMore || (!hasMore && !isNewSearch)) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/historico-all?page=${pageNum}&limit=20&search=${search}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        if (data.length < 20) setHasMore(false);
        setFeedTriages(prev => isNewSearch ? data : [...prev, ...data]);
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
        if (Array.isArray(data)) setMapTriages(data);
      });
  }, [mapBounds]);

  // Initial Load
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchFeed(1, true);
  }, [search]);'

$content = $content.Replace($oldFetch, $newFetch)

# 3. Update Infinite Scroll Observer
$observerEffect = '
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        setPage(prev => {
          const next = prev + 1;
          fetchFeed(next);
          return next;
        });
      }
    }, { threshold: 1.0 });

    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, fetchFeed]);
'
# Insert this after initial load effects (I'll find a good anchor)
$content = $content.Replace('fetchFeed(1, true);
  }, [search]);', 'fetchFeed(1, true);
  }, [search]);' + $observerEffect)

# 4. Update Metrics to use mapTriages
$content = $content.Replace('}, [unidadesRaw, triages]);', '}, [unidadesRaw, mapTriages]);')

# 5. Fix UI render to use feedTriages and mapTriages
$content = $content.Replace('triages={triages}', 'triages={mapTriages}')
$content = $content.Replace('onNodeClick={(id) => {
               const t = triages.find(tri => tri.id === id);', 'onNodeClick={(id) => {
               const t = [...feedTriages, ...mapTriages].find(tri => tri.id === id);')

# Update rendering of the list
$content = $content.Replace('{filteredTriages.map(t => (', '{feedTriages.map(t => (')
$content = $content.Replace('</TriageCard>', '</TriageCard>')

# Insert the loader div after the map
if ($content -notmatch "loaderRef") {
    $content = $content.Replace('))}
           </div>
        </aside>', '))}
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
           </div>
        </aside>')
}

# Add onBoundsChange to MapComponent
$content = $content.Replace('onNodeClick={', 'onBoundsChange={(b) => setMapBounds(b)}`nonNodeClick={')

$content | Set-Content $path -Encoding UTF8
