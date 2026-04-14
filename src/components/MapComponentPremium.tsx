"use client";

import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const TILE_LAYERS: Record<string, string> = {
  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  hybrid: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
};

const BRASILIA_COORDS: [number, number] = [-15.7801, -47.9292];

// 🏠 Ícone de Unidade Avançado (Casa + Métricas)
const createUnitIcon = (unidade: Unidade, active: boolean) => {
  const color = "#0088ff";
  const size = active ? 44 : 36;
  const count = unidade.totalTriagens || 0;
  const sat = unidade.satisfacao ?? 100;
  
  const satColor = sat > 80 ? "#22c55e" : sat > 50 ? "#f59e0b" : "#ef4444";

  const svgHouse = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  `;

  if (typeof window === "undefined" || !L || !L.divIcon) return null;

  return L.divIcon({
    className: "house-icon-wrapper",
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; width: 60px; height: 90px;">
        
        <!-- Badge de Satisfação (%) -->
        <div style="
          background: ${satColor}; color: white; 
          padding: 2px 6px; border-radius: 8px; 
          font-family: monospace; font-weight: 900; font-size: 10px;
          margin-bottom: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.3);
        ">
          ${sat}%
        </div>

        <!-- Badge de Pessoas (User Icon + Count) -->
        <div style="
          background: #334155; color: white; 
          padding: 2px 6px; border-radius: 8px; 
          font-family: monospace; font-weight: 900; font-size: 10px;
          margin-bottom: 4px; display: flex; align-items: center; gap: 3px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.1);
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          ${count}
        </div>

        <!-- Ícone da Casa -->
        <div style="
          width: ${size}px; height: ${size}px; 
          background: ${active ? 'rgba(255,255,255,0.7)' : 'rgba(12,14,20,0.95)'}; 
          border: 2px solid ${color}; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 20px ${color}60;
          transition: all 0.3s ease;
          color: ${active ? '#02040a' : color};
          backdrop-filter: blur(4px);
        ">
          ${svgHouse}
        </div>
      </div>
    `,
    iconSize: [60, 90],
    iconAnchor: [30, 85],
  });
};

// 🔴 Ícone de Cluster / Triagem (Ponto Colorido + Contador)
const createTriageIcon = (classificacao: string, active: boolean, count: number = 1, origem?: string) => {
  const cls = (classificacao || "verde").toLowerCase();
  const color = 
    cls === "vermelho" ? "#ef4444" : 
    cls === "laranja" ? "#f97316" : 
    cls === "amarelo" ? "#f59e0b" : 
    cls === "verde" ? "#22c55e" : "#3b82f6";

  const size = active ? 12 : 8;
  const hitArea = count > 1 ? 32 : 24; 
  const glow = active ? `0 0 15px ${color}` : `0 0 5px ${color}60`;

  if (typeof window === "undefined" || !L || !L.divIcon) return null;

  return L.divIcon({
    className: "triage-icon",
    html: `
      <div style="
        width: 100%; height: 100%;
        display: flex; align-items: center; justify-content: center;
        position: relative;
      ">
        <div style="
          width: ${size}px; height: ${size}px; 
          background: ${color}; 
          border: 1.5px solid white; border-radius: 50%;
          box-shadow: ${glow};
          transform: ${active ? 'scale(1.3)' : 'scale(1)'};
          transition: all 0.3s ease;
        "></div>
        ${count > 1 ? `
          <div style="
            position: absolute; top: -5px; right: -5px;
            background: ${color}; color: white;
            border: 1.5px solid white; border-radius: 8px;
            padding: 2px 4px; font-size: 9px; font-family: monospace;
            font-weight: 900; box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            white-space: nowrap; z-index: 10;
          ">
            +${count - 1}
          </div>
        ` : ""}
      </div>
    `,
    iconSize: [hitArea, hitArea],
    iconAnchor: [hitArea / 2, hitArea / 2],
  });
};

function MapFlyToFocus({ eventFocus }: { eventFocus?: { lat: number; lng: number; zoom: number; ts: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (eventFocus && eventFocus.ts && typeof eventFocus.lat === 'number' && typeof eventFocus.lng === 'number' && !isNaN(eventFocus.lat) && !isNaN(eventFocus.lng)) {
       map.flyTo([eventFocus.lat, eventFocus.lng], eventFocus.zoom, { animate: true, duration: 1.5 });
    }
  }, [eventFocus, map]);
  return null;
}

interface Triage {
  id: string;
  latitude: number;
  longitude: number;
  classificacao: string;
  paciente_nome?: string;
  descricao?: string;
  origem?: string;
  unit_lat?: number;
  unit_lng?: number;
}

interface Unidade {
  id: string;
  nome: string;
  lat: number;
  lng: number;
  endereco?: string;
  totalTriagens?: number;
  satisfacao?: number;
}

interface MapComponentProps {
  triages: Triage[];
  unidades?: Unidade[];
  selectedTriageId: string | null;
  onNodeClick: (id: string) => void;
  onBoundsChange?: (bounds: L.LatLngBounds) => void;
  currentLayer: string;
  eventFocus?: { lat: number; lng: number; zoom: number; ts: number } | null;
  isHeatmap?: boolean;
  privacyMode?: boolean;
  initialCenter?: [number, number];
  initialZoom?: number;
}

function MapBoundsHandler({ onBoundsChange }: { onBoundsChange?: (bounds: L.LatLngBounds) => void }) {
  const map = useMapEvents({
    moveend: () => {
      if (onBoundsChange) onBoundsChange(map.getBounds());
    },
    zoomend: () => {
      if (onBoundsChange) onBoundsChange(map.getBounds());
    }
  });

  // Disparar uma vez no mount se possível (após o Leaflet inicializar)
  useEffect(() => {
    const handle = setTimeout(() => {
      if (onBoundsChange) onBoundsChange(map.getBounds());
    }, 500);
    return () => clearTimeout(handle);
  }, [map, onBoundsChange]);

  return null;
}

export default function MapComponentPremium({ 
  triages, unidades = [], selectedTriageId, onNodeClick, onBoundsChange, currentLayer, eventFocus, isHeatmap, privacyMode,
  initialCenter = [-15.7801, -47.9292],
  initialZoom = 12
}: MapComponentProps) {
  
  // Bucketing logic para agrupamento geográfico (Clustering)
  const groupedTriages = React.useMemo(() => {
    const groups: Record<string, Triage[]> = {};
    triages.forEach(t => {
      if (t.latitude == null || t.longitude == null) return;
      // Precisão aumentada (6 casas = ~11cm) para evitar sumiço em zoom máximo
      const lat = parseFloat(t.latitude.toString()).toFixed(6);
      const lng = parseFloat(t.longitude.toString()).toFixed(6);
      const key = `${lat},${lng}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return Object.values(groups);
  }, [triages]);

  const heatmapData = triages.filter(t => 
    t.latitude != null && 
    t.longitude != null && 
    !isNaN(parseFloat(t.latitude.toString())) && 
    !isNaN(parseFloat(t.longitude.toString()))
  );

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer 
        center={initialCenter} 
        zoom={initialZoom} 
        maxZoom={22}
        zoomControl={false}
        style={{ height: "100%", width: "100%", background: "#0c0e14" }}
        attributionControl={false}
      >
        <MapFlyToFocus eventFocus={eventFocus} />
        <MapBoundsHandler onBoundsChange={onBoundsChange} />

        <TileLayer
          key={currentLayer}
          url={TILE_LAYERS[currentLayer] || TILE_LAYERS.dark}
          attribution='&copy; CARTO'
          maxZoom={22}
          maxNativeZoom={18}
          className={currentLayer === 'dark' ? 'map-tiles-dark-premium' : ''}
        />

        {/* --- Renderizar Linhas de Fluxo (Paciente -> Unidade) --- */}
        {React.useMemo(() => triages.filter(t => 
          t.latitude != null && t.longitude != null && 
          t.unit_lat != null && t.unit_lng != null &&
          !isNaN(parseFloat(t.latitude.toString())) && !isNaN(parseFloat(t.longitude.toString())) &&
          !isNaN(parseFloat(t.unit_lat.toString())) && !isNaN(parseFloat(t.unit_lng.toString()))
        ).map((t) => (
          <Polyline
            key={`flow-${t.id}-${t.latitude}-${t.longitude}`}
            positions={[
              [parseFloat(t.latitude.toString()), parseFloat(t.longitude.toString())],
              [parseFloat(t.unit_lat.toString()), parseFloat(t.unit_lng.toString())]
            ]}
            pathOptions={{
              color: "#facc15",
              weight: 2,
              opacity: 0.6,
              dashArray: "5, 10",
              lineCap: "round",
            }}
          />
        )), [triages])}

        {/* --- Renderizar Unidades (Casas) --- */}
        {React.useMemo(() => unidades.filter(u => u.lat != null && u.lng != null && !isNaN(parseFloat(u.lat.toString())) && !isNaN(parseFloat(u.lng.toString()))).map((u) => (
          <Marker 
            key={`unit-${u.id}`} 
            position={[parseFloat(u.lat.toString()), parseFloat(u.lng.toString())]} 
            icon={createUnitIcon(u, false)}
            eventHandlers={{
              click: () => onNodeClick(u.id)
            }}
          >
            <Popup className="custom-popup">
              <div className="font-mono text-[11px] text-slate-900 font-bold p-1">
                <div className="border-b border-black/10 pb-1 mb-1 text-[#0088ff]">{u.nome}</div>
                <div className="opacity-60 text-[9px] mb-2">{u.endereco}</div>
                <div className="flex justify-between items-center bg-slate-100 p-2 rounded-lg">
                   <div className="text-[9px]">DEMANDA: <span className="text-blue-600">{u.totalTriagens || 0}</span></div>
                   <div className="text-[9px]">SATISFAÇÃO: <span className="${(u.satisfacao || 0) > 80 ? 'text-green-600' : 'text-red-600'}">{u.satisfacao || 100}%</span></div>
                </div>
              </div>
            </Popup>
          </Marker>
        )), [unidades, onNodeClick])}

        {/* --- Modo Heatmap (Mapa de Calor Tático 'Fumaça') --- */}
        {isHeatmap && heatmapData.map((t, idx) => {
          const cls = (t.classificacao || "verde").toLowerCase();
          
          // Cores táticas com transparência para blend
          const color = 
            cls === "vermelho" ? "#ff0000" : 
            cls === "laranja" ? "#ff9100" : 
            cls === "amarelo" ? "#ffea00" : "#00ff44";

          return (
            <React.Fragment key={`heat-group-${t.id}-${idx}`}>
              {/* Camada Externa (Aura) */}
              <CircleMarker
                center={[parseFloat(t.latitude.toString()), parseFloat(t.longitude.toString())]}
                pathOptions={{ 
                  fillColor: color, 
                  color: 'transparent', 
                  fillOpacity: 0.15,
                  className: 'heatmap-thermal-aura'
                }}
                radius={4}
                interactive={false}
              />
              {/* Camada Média (Halo) */}
              <CircleMarker
                center={[parseFloat(t.latitude.toString()), parseFloat(t.longitude.toString())]}
                pathOptions={{ 
                  fillColor: color, 
                  color: 'transparent', 
                  fillOpacity: 0.35,
                  className: 'heatmap-thermal-halo'
                }}
                radius={2}
                interactive={false}
              />
              {/* Núcleo (Core) - Mais intenso conforme proximidade */}
              <CircleMarker
                center={[parseFloat(t.latitude.toString()), parseFloat(t.longitude.toString())]}
                pathOptions={{ 
                  fillColor: color, 
                  color: 'transparent', 
                  fillOpacity: 0.65,
                  className: 'heatmap-thermal-core'
                }}
                radius={1}
                interactive={false}
              />
            </React.Fragment>
          );
        })}
        
        {/* Adicionar CSS Global para o efeito de fumaça térmica */}
        <style dangerouslySetInnerHTML={{ __html: `
          .heatmap-thermal-aura {
            filter: blur(2px);
            mix-blend-mode: plus-lighter;
            pointer-events: none;
          }
          .heatmap-thermal-halo {
            filter: blur(1px);
            mix-blend-mode: plus-lighter;
            pointer-events: none;
          }
          .heatmap-thermal-core {
            filter: blur(0.5px);
            mix-blend-mode: screen;
            pointer-events: none;
          }
          @keyframes pulse-heat {
            from { opacity: 0.4; }
            to { opacity: 0.7; }
          }
          .leaflet-container {
            background: #02040a !important;
          }
        `}} />

        {/* --- Renderizar Triagens Agrupadas (Clusters) - Apenas se NÃO for heatmap --- */}
        {!isHeatmap && React.useMemo(() => groupedTriages.map((group, gIdx) => {
          // Determinar prioridade de cor no cluster
          const priority = ["vermelho", "laranja", "amarelo", "verde", "azul"];
          let bestClass = "verde";
          for (const p of priority) {
            if (group.some(t => (t.classificacao || "").toLowerCase() === p)) {
              bestClass = p;
              break;
            }
          }

          const first = group[0];
          const hasSelected = selectedTriageId ? group.some(t => t.id === selectedTriageId) : false;
          
          return (
            <Marker 
              key={`group-${first.id}-${gIdx}-${bestClass}-${hasSelected}`} 
              position={[parseFloat(first.latitude.toString()), parseFloat(first.longitude.toString())]} 
              icon={createTriageIcon(bestClass, hasSelected, group.length, first.origem)}
              eventHandlers={{
                click: () => onNodeClick(first.id)
              }}
            >
              <Popup className="custom-popup">
                <div className="font-mono text-[11px] text-slate-900 font-bold p-1 max-h-40 overflow-y-auto custom-scrollbar min-w-[140px]">
                  {group.length > 1 && (
                    <div className="text-[9px] text-[#0088ff] border-b border-black/10 pb-1 mb-2">
                       {group.length} OCORRÊNCIAS NESTE LOCAL
                    </div>
                  )}
                  {group.map((t, idx) => {
                    const displayName = privacyMode
                      ? (t.paciente_nome?.charAt(0) || "P") + "•••••"
                      : (t.paciente_nome || "Paciente");
                    
                    return (
                      <div 
                        key={t.id} 
                        onClick={() => onNodeClick(t.id)}
                        className={`py-2 px-1 cursor-pointer hover:bg-slate-100 transition-colors rounded ${idx < group.length - 1 ? 'border-b border-black/5' : ''}`}
                      >
                         <div className="text-[#0088ff] flex items-center justify-between">
                            {displayName}
                            {selectedTriageId === t.id && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                         </div>
                         <div className="uppercase opacity-60 text-[8px]">Classificação: {t.classificacao}</div>
                      </div>
                    );
                  })}
                </div>
              </Popup>
            </Marker>
          );
        }), [groupedTriages, selectedTriageId, privacyMode, onNodeClick])}

        <style jsx global>{`
          .leaflet-container {
            background: #0c0e14 !important;
          }
          .map-tiles-dark-premium {
            filter: brightness(1.6) contrast(1.1) saturate(0.5) !important;
          }
          .leaflet-popup-content-wrapper {
            background: rgba(255, 255, 255, 0.98) !important;
            border-radius: 16px !important;
            box-shadow: 0 20px 40px rgba(0,0,0,0.4) !important;
          }
          
          .heatmap-thermal-node {
            filter: blur(25px);
            mix-blend-mode: screen;
            animation: thermalFlutter 4s infinite ease-in-out;
          }

          @keyframes thermalFlutter {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.1); }
          }

          .triage-icon > div {
            cursor: pointer;
            pointer-events: auto;
          }
        `}</style>
      </MapContainer>
    </div>
  );
}

