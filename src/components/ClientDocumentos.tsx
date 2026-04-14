"use client";

import React, { useState, useRef } from "react";
import { Session } from "next-auth";
import HeaderPerfil from "@/components/HeaderIn";
import { useTheme } from "@/components/ThemeProvider";
import toast, { Toaster } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { FiExternalLink, FiTrash2 } from "react-icons/fi";

interface Props {
  sessionServer: Session;
}

interface Documento {
  id: number;
  tipo: string;
  nomeArquivo: string;
  hash: string;
  status: string;
  url?: string;
}

export default function ClientDocumentos({ sessionServer }: Props) {
  const router = useRouter();
  const { tema } = useTheme();

  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [arquivoIdentificacao, setArquivoIdentificacao] = useState<File | null>(null);
  const [arquivoComprovante, setArquivoComprovante] = useState<File | null>(null);

  const inputIdentificacaoRef = useRef<HTMLInputElement>(null);
  const inputComprovanteRef = useRef<HTMLInputElement>(null);

  const userId = sessionServer.user?.id;

  // Fetch documentos ao montar
  React.useEffect(() => {
    if (!userId) return;

    async function fetchDocumentos() {
      try {
        const res = await fetch(`/api/documentos?user_id=${userId}`, {
          method: "GET",
          cache: "no-store", // 🚫 sem cache
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        });

        if (!res.ok) throw new Error("Erro ao carregar documentos");
        const data = await res.json();
        setDocumentos(data.documentos || []);
      } catch (err) {
        console.error(err);
        toast.error("Erro ao carregar documentos", { position: "top-center" });
      }
    }

    fetchDocumentos();
  }, [userId]);

  const handleUpload = async (tipo: "identificacao" | "residencia") => {
    const file = tipo === "identificacao" ? arquivoIdentificacao : arquivoComprovante;
    if (!file || !userId) return toast.error("Selecione um arquivo", { position: "top-center" });

    const formData = new FormData();
    formData.append("tipo", tipo);
    formData.append("file", file);
    formData.append("user_id", userId);

    toast.loading("Enviando documento...", { id: "upload-doc", position: "top-center" });

    try {
      const res = await fetch("/api/documentos", {
        method: "POST",
        body: formData,
        cache: "no-store",
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        toast.error(data.error || "Erro ao enviar documento", { id: "upload-doc", position: "top-center" });
        return;
      }

      toast.success("Documento enviado!", { id: "upload-doc", position: "top-center" });

      setDocumentos((prev) => [
        ...prev.filter((d) => d.tipo !== tipo),
        {
          id: Date.now(),
          tipo,
          nomeArquivo: data.nomeArquivo,
          hash: data.hash,
          status: "Enviado",
          url: data.url,
        },
      ]);

      if (tipo === "identificacao") setArquivoIdentificacao(null);
      else setArquivoComprovante(null);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar documento", { id: "upload-doc", position: "top-center" });
    }
  };

  const handleRemove = async (tipo: "identificacao" | "residencia", hash: string) => {
    if (!window.confirm("Deseja realmente remover este documento?")) return;
    try {
      const res = await fetch(`/api/documentos?user_id=${userId}&hash=${hash}`, {
        method: "DELETE",
        cache: "no-store",
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });

      if (!res.ok) throw new Error("Erro ao remover documento");

      setDocumentos((prev) => prev.filter((d) => d.hash !== hash));
      toast.success("Documento removido", { position: "top-center" });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao remover documento", { position: "top-center" });
    }
  };

  const FileUploadCard = ({
    label,
    file,
    onSelect,
    onUpload,
    inputRef,
  }: {
    label: string;
    file: File | null;
    onSelect: (file: File | null) => void;
    onUpload: () => void;
    inputRef: React.RefObject<HTMLInputElement>;
  }) => (
    <div
      className="border-2 border-dashed border-gray-400 dark:border-gray-600 rounded-xl p-6 flex flex-col items-center justify-center space-y-4 hover:border-blue-500 transition cursor-pointer w-full"
      onClick={() => inputRef.current?.click()}
    >
      <p className="text-gray-700 dark:text-gray-200 text-base text-center break-words w-full">
        {file ? file.name : `Clique ou arraste para selecionar o ${label}`}
      </p>
      <input type="file" className="hidden" ref={inputRef} onChange={(e) => onSelect(e.target.files?.[0] || null)} />
      <button
        type="button"
        className="w-full md:w-auto flex items-center justify-center space-x-2 px-6 py-2 font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition"
        onClick={(e) => {
          e.stopPropagation();
          if (file) onUpload();
          else inputRef.current?.click();
        }}
      >
        {file ? "Enviar" : "Selecionar arquivo"}
      </button>
    </div>
  );

  const renderSection = (
    tipo: "identificacao" | "residencia",
    titulo: string,
    file: File | null,
    setFile: any,
    inputRef: any
  ) => (
    <div className="w-full">
      <h2 className="font-bold text-xl mb-3">{titulo}</h2>
      {documentos.filter((d) => d.tipo === tipo).length === 0 ? (
        <FileUploadCard label={titulo} file={file} onSelect={setFile} onUpload={() => handleUpload(tipo)} inputRef={inputRef} />
      ) : (
        documentos
          .filter((d) => d.tipo === tipo)
          .map((doc) => (
            <div
              key={doc.hash}
              className={`p-4 rounded-lg border ${tema.borderColor} bg-white dark:bg-gray-800 flex flex-col md:flex-row justify-between items-start md:items-center mb-3 w-full shadow-sm`}
            >
              <div className="flex flex-col mb-3 md:mb-0 break-words w-full md:w-2/3">
                <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{doc.nomeArquivo}</span>
                <span className="text-sm text-gray-800 dark:text-gray-300 mt-1 break-words">
                  <span className="font-bold">Hash:</span> {doc.hash}
                </span>
                <span className="text-sm text-gray-800 dark:text-gray-300 mt-1">
                  <span className="font-bold">Status:</span> {doc.status}
                </span>
              </div>

              <div className="flex flex-col md:flex-row md:space-x-2 space-y-2 md:space-y-0 w-full md:w-auto">
                {doc.url && (
                  <a
                    href={doc.url}
                    target="_blank"
                    className="flex items-center justify-center md:justify-start space-x-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm md:text-base w-full md:w-auto transition"
                  >
                    <FiExternalLink className="text-white" />
                    <span>Abrir</span>
                  </a>
                )}
                <button
                  onClick={() => handleRemove(tipo, doc.hash)}
                  className="flex items-center justify-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm md:text-base w-full md:w-auto transition"
                >
                  <FiTrash2 className="text-white" />
                  <span>Remover</span>
                </button>
              </div>
            </div>
          ))
      )}
    </div>
  );

  return (
    <main className={`${tema.mainBg} min-h-screen w-full`}>
      <HeaderPerfil paginaAtiva="perfil" tipoU="" sessionServer={sessionServer} />
      <div className="p-5 max-w-xl mx-auto w-full space-y-6">
        <h1 className={`text-2xl md:text-3xl font-bold ${tema.textPrimary}`}>Documentos</h1>
        <p className="text-base md:text-lg text-gray-700 dark:text-gray-300">
          Envie seus documentos para atualização do perfil.
        </p>

        {renderSection("identificacao", "Documento de Identificação", arquivoIdentificacao, setArquivoIdentificacao, inputIdentificacaoRef)}
        {renderSection("residencia", "Comprovante de Residência", arquivoComprovante, setArquivoComprovante, inputComprovanteRef)}

        <button
          type="button"
          className="w-full flex items-center justify-center space-x-2 px-6 py-3 font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 mt-6 transition"
          onClick={() => router.push("/perfil")}
        >
          <span>Voltar para Perfil</span>
        </button>
      </div>
      <Toaster position="top-center" reverseOrder={false} />
    </main>
  );
}
