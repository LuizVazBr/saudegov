"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { FiX, FiHome, FiMapPin, FiPhone, FiVideo, FiImage, FiMic, FiYoutube, FiCheckCircle } from "react-icons/fi";
import { toast } from "react-hot-toast";
import dynamic from "next/dynamic";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Dynamic import for Map to avoid SSR issues
const MapContainer = dynamic(() => import("react-leaflet").then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then(mod => mod.Marker), { ssr: false });

interface UnitFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  unit?: any; 
  isTeste?: boolean;
}

export default function UnitFormModal({ isOpen, onClose, onSuccess, unit, isTeste }: UnitFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    tipo: "UPA",
    endereco: "",
    lat: -15.7801,
    lng: -47.9292,
    telefone: "",
    whatsapp: "",
    youtubeLink: "",
  });

  const [geocoding, setGeocoding] = useState(false);

  const [foto, setFoto] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audio, setAudio] = useState<File | null>(null);

  useEffect(() => {
    if (unit) {
      setFormData({
        nome: unit.nome || "",
        tipo: unit.tipo || "UPA",
        endereco: unit.endereco || "",
        lat: parseFloat(unit.lat) || -15.7801,
        lng: parseFloat(unit.lng) || -47.9292,
        telefone: unit.telefone || "",
        whatsapp: unit.whatsapp || "",
        youtubeLink: unit.video_url?.startsWith("http") ? unit.video_url : "",
      });
    } else {
      setFormData({
        nome: "",
        tipo: "UPA",
        endereco: "",
        lat: -15.7801,
        lng: -47.9292,
        telefone: "",
        whatsapp: "",
        youtubeLink: "",
      });
    }
    setFoto(null);
    setVideoFile(null);
    setAudio(null);
  }, [unit, isOpen]);

  const handleMarkerDragEnd = (event: any) => {
    const marker = event.target;
    if (marker) {
      const position = marker.getLatLng();
      setFormData(prev => ({ ...prev, lat: position.lat, lng: position.lng }));
    }
  };

  // Custom Icon to fix broken Leaflet default icon
  const customIcon = useMemo(() => {
    if (typeof window === 'undefined' || !L || !L.divIcon) return null;
    return L.divIcon({
      className: "custom-marker-icon",
      html: `
        <div style="
          width: 32px;
          height: 32px;
          background-color: #2563eb;
          border: 3px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="width: 10px; height: 10px; background-color: white; border-radius: 50%; transform: rotate(45deg);"></div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });
  }, []);

  const DraggableMarker = () => {
    const markerRef = useRef(null);
    const eventHandlers = useMemo(
      () => ({
        dragend: handleMarkerDragEnd,
      }),
      []
    );

    return (
      <Marker
        draggable={true}
        eventHandlers={eventHandlers}
        position={[formData.lat, formData.lng]}
        ref={markerRef}
        icon={customIcon || undefined}
      />
    );
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = new FormData();
      if (unit?.id) data.append("id", unit.id);
      data.append("nome", formData.nome);
      data.append("tipo", formData.tipo);
      data.append("endereco", formData.endereco);
      data.append("lat", formData.lat.toString());
      data.append("lng", formData.lng.toString());
      data.append("telefone", formData.telefone);
      data.append("whatsapp", formData.whatsapp);
      data.append("youtubeLink", formData.youtubeLink);

      if (foto) data.append("foto", foto);
      if (videoFile) data.append("videoFile", videoFile);
      if (audio) data.append("audio", audio);

      const res = await fetch(`/api/admin/unidades?teste=${isTeste ? "true" : "false"}`, {
        method: "POST", // O endpoint admin/unidades trata POST com ID como UPDATE
        body: data,
      });

      const result = await res.json();

      if (res.ok) {
        toast.success(unit ? "Unidade atualizada!" : "Unidade cadastrada!");
        onSuccess();
        onClose();
      } else {
        toast.error(result.error || "Erro ao salvar unidade");
      }
    } catch (err) {
      toast.error("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  const handleGeocode = async () => {
    if (!formData.endereco.trim()) {
      toast.error("Digite o endereço para localizar no mapa");
      return;
    }

    setGeocoding(true);
    try {
      const res = await fetch(`/api/admin/geocode?address=${encodeURIComponent(formData.endereco)}`);
      const data = await res.json();

      if (res.ok) {
        setFormData(prev => ({
          ...prev,
          lat: data.lat,
          lng: data.lng
        }));
        toast.success("Localização encontrada!");
      } else {
        toast.error(data.error || "Não foi possível localizar o endereço");
      }
    } catch (err) {
      toast.error("Erro na busca de endereço");
    } finally {
      setGeocoding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto custom-scrollbar">
        <div className="sticky top-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-6 border-b dark:border-gray-700 flex justify-between items-center z-20">
          <div>
            <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight">
              {unit ? "Editar Unidade" : "Cadastrar Unidade"}
            </h2>
            <p className="text-xs text-gray-500 uppercase font-bold tracking-widest mt-1">Gestão de Infraestrutura</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition">
            <FiX size={24} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              {/* Nome */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-gray-500 tracking-widest ml-1">Nome da Unidade</label>
                <div className="relative">
                  <FiHome className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    required
                    type="text"
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none dark:text-white transition-all"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  />
                </div>
              </div>

              {/* Tipo */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-gray-500 tracking-widest ml-1">Tipo de Unidade</label>
                <select
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none dark:text-white transition-all"
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                >
                  <option value="UPA">UPA</option>
                  <option value="UBS">UBS</option>
                  <option value="Hospital">Hospital</option>
                  <option value="Clínica">Clínica</option>
                  <option value="Laboratório">Laboratório</option>
                </select>
              </div>

              {/* Endereço */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-gray-500 tracking-widest ml-1">Endereço Completo</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <FiMapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      required
                      type="text"
                      placeholder="Ex: Rua X, nº 10, Cidade - UF"
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none dark:text-white transition-all text-sm"
                      value={formData.endereco}
                      onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleGeocode}
                    disabled={geocoding}
                    className={`px-4 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center gap-2 ${
                      geocoding 
                        ? 'bg-gray-100 text-gray-400 dark:bg-gray-700' 
                        : 'bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-600/20 dark:text-blue-400 dark:hover:bg-blue-600/30 border border-blue-500/20'
                    }`}
                  >
                    {geocoding ? "..." : <><FiMapPin /> Localizar</>}
                  </button>
                </div>
              </div>

              {/* Telefones */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-gray-500 tracking-widest ml-1">Telefone</label>
                  <div className="relative">
                    <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                    <input
                      type="text"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none dark:text-white text-sm"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-gray-500 tracking-widest ml-1">WhatsApp</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none dark:text-white text-sm"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Mapa Interativo */}
            <div className="space-y-4">
              <label className="text-xs font-black uppercase text-gray-500 tracking-widest ml-1 flex justify-between">
                <span>Localização no Mapa</span>
                <span className="text-blue-500 font-mono">{formData.lat.toFixed(6)}, {formData.lng.toFixed(6)}</span>
              </label>
              <div className="h-[300px] w-full rounded-3xl overflow-hidden border-2 border-gray-100 dark:border-gray-700 shadow-inner relative z-10">
                <MapContainer 
                  center={[formData.lat, formData.lng]} 
                  zoom={16} 
                  style={{ height: "100%", width: "100%" }}
                  key={`${formData.lat}-${formData.lng}`} // Force re-render when coordinates change to center map
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <DraggableMarker />
                </MapContainer>
                <div className="absolute top-2 right-2 z-[1000] bg-white/90 dark:bg-gray-800/90 p-2 rounded-xl text-[9px] font-black uppercase shadow-lg border border-black/5 dark:border-white/5 pointer-events-none">
                  Arraste o pino para ajustar
                </div>
              </div>
            </div>
          </div>

          <hr className="dark:border-gray-700" />

          {/* Mídia */}
          <div className="space-y-6">
            <h3 className="text-sm font-black uppercase text-gray-800 dark:text-white tracking-widest">Recursos de Mídia</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Foto */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-tighter flex items-center gap-2">
                  <FiImage /> Foto da Unidade
                </label>
                <input
                  type="file"
                  accept="image/*"
                  className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  onChange={(e) => setFoto(e.target.files?.[0] || null)}
                />
              </div>

              {/* Vídeo */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-tighter flex items-center gap-2">
                  <FiVideo /> Vídeo Institucional
                </label>
                <input
                  type="file"
                  accept="video/*"
                  className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-2"
                  onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                />
                <div className="relative">
                  <FiYoutube className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500" />
                  <input
                    type="text"
                    placeholder="Ou link do YouTube"
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none dark:text-white text-xs"
                    value={formData.youtubeLink}
                    onChange={(e) => setFormData({ ...formData, youtubeLink: e.target.value })}
                  />
                </div>
              </div>

              {/* Áudio */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-tighter flex items-center gap-2">
                  <FiMic /> Áudio de Apresentação
                </label>
                <input
                  type="file"
                  accept="audio/*"
                  className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  onChange={(e) => setAudio(e.target.files?.[0] || null)}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-8 border-t dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-8 py-3 dark:border-gray-700 rounded-2xl text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition font-black uppercase text-[10px] tracking-widest"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-10 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 transition-all flex items-center gap-2 uppercase text-[10px] tracking-widest disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Processando..." : (
                <>
                  {unit ? "Atualizar Unidade" : "Cadastrar Agora"}
                  <FiCheckCircle />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
