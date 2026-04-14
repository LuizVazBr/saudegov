
"use client";

import { useState, useEffect, useRef } from "react";
import { FiEdit, FiTrash2, FiPlus, FiSave, FiX, FiUpload, FiPlayCircle, FiMusic, FiImage } from "react-icons/fi";
import { toast, Toaster } from "react-hot-toast";

interface Unidade {
    id: string;
    nome: string;
    tipo: "UBS" | "UPA";
    endereco: string;
    telefone: string;
    whatsapp: string;
    lat: number;
    lng: number;
    img_url?: string;
    video_url?: string;
    audio_url?: string;
    cliente?: string;
}

export default function AdminUnidadesPage() {
    const [unidades, setUnidades] = useState<Unidade[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingUnidade, setEditingUnidade] = useState<Partial<Unidade> | null>(null);

    // Form States
    const [formData, setFormData] = useState({
        nome: "",
        endereco: "",
        tipo: "UBS",
        telefone: "",
        whatsapp: "",
        cliente: "Isac_TO",
        lat: "-10.184",
        lng: "-48.333",
        youtubeLink: "",
    });

    const [fotoFile, setFotoFile] = useState<File | null>(null);
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchUnidades();
    }, []);

    const fetchUnidades = async () => {
        try {
            const res = await fetch("/api/admin/unidades");
            const data = await res.json();
            setUnidades(data);
        } catch (error) {
            toast.error("Erro ao carregar unidades");
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (u: Unidade) => {
        setEditingUnidade(u);
        setFormData({
            nome: u.nome,
            endereco: u.endereco,
            tipo: u.tipo,
            telefone: u.telefone || "",
            whatsapp: u.whatsapp || "",
            cliente: u.cliente || "Isac_TO",
            lat: u.lat.toString(),
            lng: u.lng.toString(),
            youtubeLink: (u.video_url && !u.video_url.startsWith("/uploads")) ? u.video_url : "",
        });
        setFotoFile(null);
        setVideoFile(null);
        setAudioFile(null);
        setModalOpen(true);
    };

    const handleNew = () => {
        setEditingUnidade(null);
        setFormData({
            nome: "",
            endereco: "",
            tipo: "UBS",
            telefone: "",
            whatsapp: "",
            cliente: "Isac_TO",
            lat: "-10.184", // Default Palmas/TO approx
            lng: "-48.333",
            youtubeLink: "",
        });
        setFotoFile(null);
        setVideoFile(null);
        setAudioFile(null);
        setModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const data = new FormData();
            if (editingUnidade?.id) data.append("id", editingUnidade.id);

            data.append("nome", formData.nome);
            data.append("endereco", formData.endereco);
            data.append("tipo", formData.tipo);
            data.append("telefone", formData.telefone);
            data.append("whatsapp", formData.whatsapp);
            data.append("cliente", formData.cliente);
            data.append("lat", formData.lat);
            data.append("lng", formData.lng);
            data.append("youtubeLink", formData.youtubeLink);

            if (fotoFile) data.append("foto", fotoFile);
            if (videoFile) data.append("videoFile", videoFile);
            if (audioFile) data.append("audio", audioFile);

            const res = await fetch("/api/admin/unidades", {
                method: "POST",
                body: data,
            });

            if (!res.ok) throw new Error("Erro ao salvar");

            toast.success("Unidade salva com sucesso!");
            setModalOpen(false);
            fetchUnidades();
        } catch (err) {
            console.error(err);
            toast.error("Erro ao salvar unidade");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-800">
            <Toaster />
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Gerenciar Unidades</h1>
                    <button
                        onClick={handleNew}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                    >
                        <FiPlus /> Nova Unidade
                    </button>
                </div>

                {loading ? (
                    <p>Carregando...</p>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200 overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead className="bg-gray-100 text-gray-600 text-sm uppercase">
                                <tr>
                                    <th className="p-4 border-b">Nome</th>
                                    <th className="p-4 border-b">Cliente</th>
                                    <th className="p-4 border-b">Tipo</th>
                                    <th className="p-4 border-b">Endereço</th>
                                    <th className="p-4 border-b text-center">Mídia</th>
                                    <th className="p-4 border-b text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {unidades.map((u) => (
                                    <tr key={u.id} className="hover:bg-gray-50">
                                        <td className="p-4 font-medium">{u.nome}</td>
                                        <td className="p-4 text-sm text-gray-600">{u.cliente}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 text-xs font-bold rounded ${u.tipo === "UPA" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"}`}>
                                                {u.tipo}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-gray-500 max-w-xs truncate" title={u.endereco}>{u.endereco}</td>
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center gap-2 text-gray-400">
                                                {u.img_url ? <FiImage className="text-blue-500" title="Possui Foto" /> : <FiImage title="Sem Foto" />}
                                                {u.video_url ? <FiPlayCircle className="text-red-500" title="Possui Vídeo" /> : <FiPlayCircle title="Sem Vídeo" />}
                                                {u.audio_url ? <FiMusic className="text-green-500" title="Possui Áudio" /> : <FiMusic title="Sem Áudio" />}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => handleEdit(u)}
                                                className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50"
                                            >
                                                <FiEdit size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* MODAL */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h2 className="text-xl font-bold text-gray-800">
                                {editingUnidade ? "Editar Unidade" : "Nova Unidade"}
                            </h2>
                            <button onClick={() => setModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                                <FiX size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                {/* Dados Básicos */}
                                <div className="col-span-1 md:col-span-2 space-y-4">
                                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Dados Principais</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Unidade</label>
                                            <input
                                                required
                                                type="text"
                                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={formData.nome}
                                                onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                                            <input
                                                required
                                                type="text"
                                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={formData.cliente}
                                                onChange={e => setFormData({ ...formData, cliente: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                                            <select
                                                className="w-full p-2 border border-gray-300 rounded-md"
                                                value={formData.tipo}
                                                onChange={e => setFormData({ ...formData, tipo: e.target.value })}
                                            >
                                                <option value="UBS">UBS</option>
                                                <option value="UPA">UPA</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                                            <input
                                                required
                                                type="text"
                                                className="w-full p-2 border border-gray-300 rounded-md"
                                                value={formData.endereco}
                                                onChange={e => setFormData({ ...formData, endereco: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                                            <input
                                                type="text"
                                                className="w-full p-2 border border-gray-300 rounded-md"
                                                value={formData.lat}
                                                onChange={e => setFormData({ ...formData, lat: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                                            <input
                                                type="text"
                                                className="w-full p-2 border border-gray-300 rounded-md"
                                                value={formData.lng}
                                                onChange={e => setFormData({ ...formData, lng: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                                            <input
                                                type="text"
                                                className="w-full p-2 border border-gray-300 rounded-md"
                                                value={formData.telefone}
                                                onChange={e => setFormData({ ...formData, telefone: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Whatsapp</label>
                                            <input
                                                type="text"
                                                className="w-full p-2 border border-gray-300 rounded-md"
                                                value={formData.whatsapp}
                                                onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Mídia */}
                                <div className="col-span-1 md:col-span-2 space-y-4 border-t pt-4">
                                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Mídia e Arquivos</h3>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {/* FOTO */}
                                        <div className="bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300 text-center">
                                            <FiImage className="mx-auto text-gray-400 mb-2" size={24} />
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Foto da Unidade</label>
                                            {editingUnidade?.img_url && !fotoFile && (
                                                <div className="mb-2">
                                                    <img src={editingUnidade.img_url} className="h-20 w-auto mx-auto rounded shadow-sm object-cover" />
                                                    <p className="text-xs text-green-600 mt-1">Imagem Atual</p>
                                                </div>
                                            )}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="w-full text-xs text-gray-500 file:mr-2 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                                onChange={e => setFotoFile(e.target.files?.[0] || null)}
                                            />
                                        </div>

                                        {/* VIDEO */}
                                        <div className="bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300 text-center">
                                            <FiPlayCircle className="mx-auto text-gray-400 mb-2" size={24} />
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Vídeo</label>
                                            {editingUnidade?.video_url && !videoFile && !formData.youtubeLink && (
                                                <div className="mb-2">
                                                    <p className="text-xs text-green-600 mt-1 truncate max-w-[150px] mx-auto">{editingUnidade.video_url}</p>
                                                </div>
                                            )}
                                            <div className="space-y-2">
                                                <input
                                                    type="text"
                                                    placeholder="Link do YouTube (Opcional)"
                                                    className="w-full text-xs p-2 border rounded"
                                                    value={formData.youtubeLink}
                                                    onChange={e => setFormData({ ...formData, youtubeLink: e.target.value })}
                                                />
                                                <p className="text-xs text-gray-400">- OU -</p>
                                                <input
                                                    type="file"
                                                    accept="video/*"
                                                    className="w-full text-xs text-gray-500 file:mr-2 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                                    onChange={e => setVideoFile(e.target.files?.[0] || null)}
                                                />
                                            </div>
                                        </div>

                                        {/* AUDIO */}
                                        <div className="bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300 text-center">
                                            <FiMusic className="mx-auto text-gray-400 mb-2" size={24} />
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Áudio Explicativo</label>
                                            {editingUnidade?.audio_url && !audioFile && (
                                                <div className="mb-2">
                                                    <audio controls src={editingUnidade.audio_url} className="w-full h-8" />
                                                    <p className="text-xs text-green-600 mt-1">Áudio Atual</p>
                                                </div>
                                            )}
                                            <input
                                                type="file"
                                                accept="audio/*"
                                                className="w-full text-xs text-gray-500 file:mr-2 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                                onChange={e => setAudioFile(e.target.files?.[0] || null)}
                                            />
                                        </div>
                                    </div>
                                </div>

                            </div>

                            <div className="flex justify-end gap-4 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
                                >
                                    {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                                    {saving ? "Salvando..." : "Salvar Unidade"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
