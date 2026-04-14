"use client";

import React from "react";
import { FiX } from "react-icons/fi";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import BottomSheetModal from "../components/BottomSheetModal";

interface tema {
  btnBg: string;
  btnHover: string;
  btnMap: string;
  btnHoverMap: string;
}

interface Unidade {
  nome: string;
  lat: number;
  lng: number;
  endereco?: string;
}

interface MapaRotaProps {
  isOpen: boolean;
  onClose: () => void;
  tema: tema;
  unidadeSelecionada?: Unidade | null;
  userLocation: [number, number] | null;
}

const MapaRota: React.FC<MapaRotaProps> = ({ isOpen, onClose, unidadeSelecionada, userLocation, tema }) => {
  // Configuração segura dos ícones dentro do componente
  const houseIcon = typeof window !== "undefined" ? L.divIcon({
    className: "house-icon",
    html: `
      <div style="width: 36px; height: 36px; background: rgba(12,14,20,0.9); border: 2px solid #0088ff; border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(0,136,255,0.3);">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0088ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  }) : null;

  const triageIcon = typeof window !== "undefined" ? L.divIcon({
    className: "triage-icon",
    html: `<div style="width: 18px; height: 18px; background: #3b82f6; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  }) : null;

  const [selectedMode, setSelectedMode] = React.useState<"carro" | "pedestre">(
    "carro"
  );

  if (!isOpen || !unidadeSelecionada) return null;

  const center: [number, number] = userLocation
    ? [
      (userLocation[0] + unidadeSelecionada.lat) / 2,
      (userLocation[1] + unidadeSelecionada.lng) / 2,
    ]
    : [unidadeSelecionada.lat, unidadeSelecionada.lng];

  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={onClose}
      disableBackdropClick={true}
      disableDrag={true}
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-600">
          {`Como chegar na ${unidadeSelecionada.nome}`}
        </h2>

        <button
          onClick={onClose}
          aria-label="Fechar modal"
          className="p-0 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        >
          <FiX size={24} className="text-gray-600 dark:text-gray-300" />
        </button>
      </div>

      <div className="mb-4">{`${unidadeSelecionada.endereco || ""}`}</div>

      <div style={{ height: "300px", width: "100%" }}>
        <MapContainer
          center={center}
          zoom={13}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {userLocation && (
            <>
              <RoutingControl
                userLocation={userLocation}
                destination={[unidadeSelecionada.lat, unidadeSelecionada.lng]}
                mode={selectedMode}
              />

              {triageIcon && (
                <Marker position={userLocation} icon={triageIcon}>
                  <Popup>Você está aqui</Popup>
                </Marker>
              )}
            </>
          )}

          {houseIcon && unidadeSelecionada.lat != null && unidadeSelecionada.lng != null && (
            <Marker position={[unidadeSelecionada.lat, unidadeSelecionada.lng]} icon={houseIcon}>
              <Popup>{unidadeSelecionada.nome}</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      <div className="mt-4">
        <p className="text-lg font-medium text-gray-800 dark:text-gray-600 mb-2">
          Selecione o modo de transporte:
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setSelectedMode("carro")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${selectedMode === "carro"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
              }`}
          >
            🚗 Carro
          </button>
          <button
            onClick={() => setSelectedMode("pedestre")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${selectedMode === "pedestre"
              ? "bg-green-600 text-white"
              : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
              }`}
          >
            🚶 A Pé
          </button>
        </div>
      </div>
    </BottomSheetModal>
  );
};

// Componente interno para roteamento
const RoutingControl = ({
  userLocation,
  destination,
  mode,
}: {
  userLocation: [number, number];
  destination: [number, number];
  mode: "carro" | "pedestre";
}) => {
  const map = useMap();
  const routingRef = React.useRef<any>(null);

  React.useEffect(() => {
    if (!map) return;

    const cleanup = () => {
      if (routingRef.current) {
        try {
          routingRef.current.setWaypoints([]);
          map.removeControl(routingRef.current);
        } catch (e) { }
        routingRef.current = null;
      }
    };

    cleanup();

    const routing = (L as any).Routing.control({
      waypoints: [
        L.latLng(userLocation[0], userLocation[1]),
        L.latLng(destination[0], destination[1]),
      ],
      routeWhileDragging: false,
      show: true,
      addWaypoints: false,
      fitSelectedRoutes: true,
      showAlternatives: false,
      lineOptions: {
        styles: [{ color: mode === "pedestre" ? "green" : "blue", opacity: 0.7, weight: 5 }],
        extendToWaypoints: false,
        missingRouteTolerance: 0,
      },
      createMarker: () => null,
      router: new (L as any).Routing.OSRMv1({
        profile: mode === "pedestre" ? "foot" : "car",
        serviceUrl: "https://router.project-osrm.org/route/v1",
        language: "pt-BR",
      }),
      formatter: new (L as any).Routing.Formatter({
        language: "pt-BR",
        units: "metric",
        roundingSensitivity: 1,
      } as any),
    } as any);

    routing.addTo(map);
    routingRef.current = routing;

    return cleanup;
  }, [map, userLocation, destination, mode]);

  return null;
};

export default MapaRota;
