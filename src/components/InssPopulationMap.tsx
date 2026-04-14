"use client";

import React, { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const TILE_LAYERS = {
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
};

// 📍 Ícone de Unidade Customizado
const createUnitIcon = (status: string) => {
  const color = status === 'Crítico' ? '#ef4444' : status === 'Atenção' ? '#f59e0b' : '#22c55e';
  
  if (typeof window === "undefined" || !L.divIcon) return null;

  return L.divIcon({
    className: "custom-unit-icon",
    html: `
      <div style="
        width: 32px; height: 32px; 
        background: ${color}; 
        border: 3px solid white; border-radius: 10px;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 15px ${color}60;
        color: white;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
};

function MapFlyTo({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.5 });
  }, [center, zoom, map]);
  return null;
}

interface InssPopulationMapProps {
  units: any[];
  patients: any[];
  triages?: any[];
  filters: {
    disease: string;
    risk: string;
    unitType: string;
  };
  onRegionClick: (data: any) => void;
  center: [number, number];
  zoom: number;
}

export default function InssPopulationMap({ units, patients, triages = [], filters, onRegionClick, center, zoom }: InssPopulationMapProps) {
  
  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      const matchDisease = filters.disease === 'all' || p.doenca === filters.disease;
      const matchRisk = filters.risk === 'all' || p.risco === filters.risk;
      return matchDisease && matchRisk;
    });
  }, [patients, filters]);

  const filteredUnits = useMemo(() => {
    return units.filter(u => filters.unitType === 'all' || u.tipo === filters.unitType);
  }, [units, filters]);

  return (
    <div className="w-full h-full relative rounded-[2rem] overflow-hidden border border-slate-200 dark:border-white/5 shadow-2xl">
      <MapContainer 
        center={center} 
        zoom={zoom} 
        scrollWheelZoom={true}
        className="w-full h-full"
        zoomControl={false}
      >
        <MapFlyTo center={center} zoom={zoom} />
        <TileLayer url={TILE_LAYERS.dark} />

        {/* 🏥 Camada de Unidades */}
        {filteredUnits.map(u => (
          <Marker 
            key={u.id} 
            position={[u.lat, u.lng]} 
            icon={createUnitIcon(u.status)}
            eventHandlers={{
              click: () => onRegionClick({ type: 'unit', ...u })
            }}
          >
            <Popup className="custom-popup">
              <div className="p-2 font-mono text-[11px]">
                <div className="font-black text-[#0088ff] mb-1">{u.nome}</div>
                <div className="opacity-60 mb-2">{u.endereco}</div>
                <div className="grid grid-cols-2 gap-2 border-t pt-2 border-slate-100">
                  <div>
                    <p className="text-[8px] opacity-40">ESPERA</p>
                    <p className="font-bold">{u.metrics.waitingTime}m</p>
                  </div>
                  <div>
                    <p className="text-[8px] opacity-40">PACIENTES</p>
                    <p className="font-bold">{u.metrics.totalPatients}</p>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* 📍 Camada de Triagens em Tempo Real (Pulsos) */}
        {triages.map((t, idx) => {
           const cls = (t.classificacao || 'verde').toLowerCase();
           const color = 
              cls === 'vermelho' ? '#ef4444' : 
              cls === 'laranja' ? '#f97316' : 
              cls === 'amarelo' ? '#f59e0b' : '#22c55e';
           
           if (!t.lat || !t.lng) return null;

           return (
             <CircleMarker
                key={`t-pulse-${t.id}-${idx}`}
                center={[t.lat, t.lng]}
                pathOptions={{
                  fillColor: color,
                  color: 'white',
                  weight: 0.5,
                  fillOpacity: 0.6,
                  className: 'triage-pulse-marker'
                }}
                radius={4}
             >
                <Popup className="custom-popup">
                   <div className="p-2 text-[10px] font-mono whitespace-nowrap">
                      <p className="font-black text-rose-500 uppercase mb-1">Ocorrência Real</p>
                      <p className="font-bold">{t.paciente_nome}</p>
                      <p className="opacity-60">Status: {t.classificacao}</p>
                   </div>
                </Popup>
             </CircleMarker>
           );
        })}

        {/* 🔴 Camada de Calor / Risco de Incapacidade */}
        {filteredPatients.map((p, idx) => {
          const color = p.risco === 'Alto' ? '#ef4444' : p.risco === 'Moderado' ? '#f59e0b' : '#22c55e';
          
          return (
            <React.Fragment key={`p-${idx}`}>
              <CircleMarker
                center={[p.lat, p.lng]}
                pathOptions={{ 
                  fillColor: color, 
                  color: 'transparent', 
                  fillOpacity: 0.2,
                  className: 'heatmap-aura'
                }}
                radius={20}
              />
              <CircleMarker
                center={[p.lat, p.lng]}
                pathOptions={{ 
                  fillColor: color, 
                  color: 'white', 
                  weight: 1,
                  fillOpacity: 0.8 
                }}
                radius={4}
                eventHandlers={{
                  click: () => onRegionClick({ type: 'patient', ...p })
                }}
              />
            </React.Fragment>
          );
        })}

        <style dangerouslySetInnerHTML={{ __html: `
          .heatmap-aura {
            filter: blur(10px);
            animation: pulse-aura 3s infinite ease-in-out;
          }
          .triage-pulse-marker {
            animation: pulse-simple 2s infinite ease-in-out;
          }
          @keyframes pulse-aura {
            0%, 100% { transform: scale(1); opacity: 0.1; }
            50% { transform: scale(1.5); opacity: 0.3; }
          }
          @keyframes pulse-simple {
            0%, 100% { opacity: 0.6; stroke-width: 0.5; }
            50% { opacity: 1; stroke-width: 2; }
          }
          .leaflet-container {
            background: #02040a !important;
          }
        `}} />
      </MapContainer>
    </div>
  );
}
