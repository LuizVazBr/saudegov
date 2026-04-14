"use client";
import React, { useState, useEffect, useRef } from "react";
import { 
  User, Activity, Pill, Clipboard, 
  Search, AlertTriangle, ChevronRight, 
  ChevronDown, Move, Maximize2, Minimize2, 
  ZoomIn, ZoomOut, Target, ShieldCheck, 
  Zap, Terminal, Sparkles, BookOpen, 
  Plus, X, ExternalLink, Layers, 
  GitBranch, FolderOpen, FolderClosed,
  Stethoscope, FileText, Calendar, Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Node {
  id: string;
  type: "root" | "triage" | "symptom" | "exam" | "treatment" | "condition" | "category";
  label: string;
  description?: string;
  x: number;
  y: number;
  parentId?: string;
  createdAt?: string; 
  isExpanded?: boolean;
  classification?: string;
  details?: any;
}

interface Connection {
  from: string;
  to: string;
}

interface PatientTreeViewProps {
  data: {
    patient: any;
    history: any[];
    exames: any[];
    tratamentos: any[];
    condicoes: any[];
  };
  onClose: () => void;
}

export default function PatientTreeView({ data, onClose }: PatientTreeViewProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeActionsId, setActiveActionsId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"map" | "tree">("tree");
  const [hasMoved, setHasMoved] = useState(false);
  const dragStartRef = useRef<{x: number, y: number} | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const applyLayout = (nodeList: Node[], mode: "map" | "tree") => {
    const root = nodeList.find(n => n.id === "root"); if (!root) return nodeList;

    if (mode === "tree") {
      const startX = 20;
      const startY = 40;
      const catSpacingY = 150;
      const itemSpacingY = 100;
      const subSpacingY = 80;

      root.x = startX; 
      root.y = startY;

      const categories = nodeList.filter(n => n.parentId === "root");
      let currentY = startY + catSpacingY;

      categories.forEach((cat) => {
        cat.x = startX + 280; 
        cat.y = currentY;
        
        if (cat.isExpanded) {
            const children = nodeList.filter(n => n.parentId === cat.id);
            children.forEach((child, j) => {
                child.x = cat.x + 300; 
                child.y = currentY + (j * itemSpacingY);
                
                if (child.isExpanded) {
                    const subNodes = nodeList.filter(n => n.parentId === child.id);
                    subNodes.forEach((sn, k) => {
                        sn.x = child.x + 300;
                        sn.y = child.y + (k * subSpacingY);
                    });
                }
            });
            // Aumenta o Y total baseado no número de filhos
            currentY += Math.max(1, children.length) * itemSpacingY;
        } else {
            currentY += catSpacingY;
        }
      });
    } else {
        root.x = 300; root.y = 350;
        const categories = nodeList.filter(n => n.parentId === "root");
        categories.forEach((cat, i) => {
            const angle = (i / categories.length) * Math.PI * 2; const r = 180;
            cat.x = 400 + Math.cos(angle) * r; cat.y = 350 + Math.sin(angle) * (r * 0.8);
            if (cat.isExpanded) {
                const children = nodeList.filter(n => n.parentId === cat.id);
                children.forEach((child, j) => {
                    const childAngle = angle + (j - (children.length-1)/2) * 0.4; const cr = 320;
                    child.x = 400 + Math.cos(childAngle) * cr; child.y = 350 + Math.sin(childAngle) * (cr * 0.8);
                });
            }
        });
    }
    return nodeList;
  };

  useEffect(() => {
    const newNodes: Node[] = []; 
    const newConns: Connection[] = []; 
    const rootId = "root";

    // Patient Root
    newNodes.push({ 
      id: rootId, 
      type: "root", 
      label: data.patient.nome, 
      description: `CPF: ${data.patient.documento}`,
      x: 200, y: 350, 
      isExpanded: true 
    });

    const categories = [
      { id: "cat-history", label: "Histórico de Triagens", data: data.history, type: "triage" },
      { id: "cat-exames", label: "Exames Realizados", data: data.exames, type: "exam" },
      { id: "cat-tratamentos", label: "Tratamentos Atuais", data: data.tratamentos, type: "treatment" },
      { id: "cat-condicoes", label: "Condições Crônicas", data: data.condicoes, type: "condition" }
    ];

    categories.forEach(cat => {
      if (cat.data && cat.data.length > 0) {
        newNodes.push({ 
          id: cat.id, 
          type: "category", 
          label: cat.label, 
          x: 0, y: 0, 
          parentId: rootId, 
          isExpanded: cat.id === "cat-history" // Expand history by default
        });
        newConns.push({ from: rootId, to: cat.id });

        cat.data.forEach((item, i) => {
          const itemId = `${cat.id}-item-${i}`;
          let label = "";
          let description = "";

          if (cat.type === "triage") {
            label = `Triagem ${new Date(item.data_cadastro).toLocaleDateString()}`;
            description = item.descricao;
          } else if (cat.type === "exam") {
            label = item.descricao;
            description = `Data: ${new Date(item.data_cadastro).toLocaleDateString()}`;
          } else if (cat.type === "treatment") {
            label = item.medicamento;
            description = item.frequencia;
          } else if (cat.type === "condition") {
            label = item.tipo;
            description = item.descricao;
          }

          newNodes.push({ 
            id: itemId, 
            type: cat.type as Node["type"], 
            label, 
            description,
            x: 0, y: 0, 
            parentId: cat.id,
            classification: item.classificacao,
            details: item
          });
          newConns.push({ from: cat.id, to: itemId });

          // Add symptoms to triage nodes
          if (cat.type === "triage" && item.sintomas && item.sintomas.length > 0) {
            item.sintomas.forEach((sint: any, j: number) => {
                const sintId = `${itemId}-sint-${j}`;
                newNodes.push({
                    id: sintId,
                    type: "symptom",
                    label: sint.nome || sint,
                    x: 0, y: 0,
                    parentId: itemId
                });
                newConns.push({ from: itemId, to: sintId });
            });
          }
        });
      }
    });

    const final = applyLayout(newNodes, viewMode);
    setNodes(final); 
    setConnections(newConns);
    
    // Center view (aligned to left)
    setOffset({ x: 0, y: 0 });
  }, [data, viewMode]);

  const toggleExpand = (nodeId: string) => {
    setNodes(prev => {
        const target = prev.find(n => n.id === nodeId);
        if (!target) return prev;
        
        const isExpanding = !target.isExpanded;
        const updated = prev.map(n => {
            if (n.id === nodeId) return { ...n, isExpanded: isExpanding };
            // Optional: exclusive logic for categories
            if (isExpanding && n.parentId === target.parentId && n.id !== nodeId && n.type === 'category') {
                return { ...n, isExpanded: false };
            }
            return n;
        });
        return applyLayout(updated, viewMode);
    });
  };

  const handleMouseDown = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggingNodeId(id);
    setSelectedNodeId(id);
    setHasMoved(false);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNodeId) {
      if (Math.abs(e.clientX - (dragStartRef.current?.x || 0)) > 5) setHasMoved(true);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const x = (e.clientX - rect.left - offset.x) / zoom; 
        const y = (e.clientY - rect.top - offset.y) / zoom;
        setNodes(prev => prev.map(n => n.id === draggingNodeId ? { ...n, x, y } : n));
      }
    }
  };

  const isVisible = (node: Node): boolean => {
    if (node.id === "root") return true;
    const parent = nodes.find(n => n.id === node.parentId);
    if (!parent) return false;
    if (parent.type === "category" && !parent.isExpanded) return false;
    if (parent.type === "triage" && !parent.isExpanded) return false;
    return isVisible(parent);
  };

  const getIcon = (type: Node["type"], expanded?: boolean) => {
    switch (type) {
      case "root": return <User className="text-emerald-400" />;
      case "category": return expanded ? <FolderOpen className="text-blue-400" /> : <FolderClosed className="text-blue-400" />;
      case "triage": return <Clipboard className="text-orange-400" />;
      case "exam": return <FileText className="text-purple-400" />;
      case "treatment": return <Pill className="text-pink-400" />;
      case "condition": return <ShieldCheck className="text-red-400" />;
      case "symptom": return <Stethoscope className="text-emerald-500" size={12} />;
      default: return <Info size={14} />;
    }
  };

  const getClassificationColor = (classification: string) => {
    const colors: Record<string, string> = {
      'vermelho': 'bg-red-500 border-red-400',
      'laranja': 'bg-orange-500 border-orange-400',
      'amarelo': 'bg-yellow-500 border-yellow-400',
      'verde': 'bg-green-500 border-green-400',
      'azul': 'bg-blue-500 border-blue-400',
    };
    return colors[classification?.toLowerCase()] || 'bg-white/5 border-white/10';
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="fixed inset-0 z-[150] bg-[#020617] flex flex-col overflow-hidden font-sans">
      {/* HEADER */}
      <header className="p-6 border-b border-white/5 flex items-center justify-between bg-black/40 z-[200]">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <GitBranch className="text-emerald-400" size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white uppercase tracking-widest leading-none">Mapa Clínico do Paciente</h2>
            <p className="text-[12px] text-white/30 uppercase mt-1">Exploração Visual — {data.patient.nome}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 p-1.5 bg-white/5 rounded-xl border border-white/10">
            <button 
              onClick={() => setViewMode(prev => prev === "tree" ? "map" : "tree")} 
              className={`p-2 rounded-lg transition-all ${viewMode === 'tree' ? 'bg-emerald-500 text-black' : 'text-white/40 hover:bg-white/10'}`}
            >
              <GitBranch size={16}/>
            </button>
            <div className="w-[1px] h-4 bg-white/10 mx-1" />
            <button 
              onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }} 
              className="p-2 hover:bg-white/10 rounded-lg text-emerald-400"
            >
              <Move size={16}/>
            </button>
            <div className="w-[1px] h-4 bg-white/10 mx-1" />
            <button onClick={() => setZoom(prev => Math.max(0.2, prev - 0.1))} className="p-2 hover:bg-white/10 rounded-lg text-white/40"><ZoomOut size={16}/></button>
            <span className="text-[12px] font-mono text-white/60 w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(prev => Math.min(2, prev + 0.1))} className="p-2 hover:bg-white/10 rounded-lg text-white/40"><ZoomIn size={16}/></button>
          </div>
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500/60 font-mono text-xs hover:text-red-500 transition-all uppercase font-bold tracking-widest">Fechar</button>
        </div>
      </header>

      {/* CANVAS */}
      <div 
        ref={containerRef} 
        className="flex-1 relative overflow-hidden bg-[radial-gradient(circle_at_center,#0f172a_0%,#020617_100%)] select-none"
        onMouseMove={handleMouseMove}
        onMouseUp={() => setDraggingNodeId(null)}
        onClick={() => { setSelectedNodeId(null); setActiveActionsId(null); }}
      >
        <div 
          className="inline-block relative min-w-[5000px] min-h-[5000px] transition-all duration-300" 
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
        >
          <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none">
            {connections.map((conn, i) => {
              const f = nodes.find(n => n.id === conn.from); 
              const t = nodes.find(n => n.id === conn.to);
              if (!f || !t || !isVisible(t)) return null;
              
              const path = viewMode === "tree" 
                ? `M ${f.x} ${f.y} L ${t.x} ${t.y}` 
                : `M ${f.x} ${f.y} C ${(f.x + t.x) / 2} ${f.y}, ${(f.x + t.x) / 2} ${t.y}, ${t.x} ${t.y}`;
              
              return <path key={i} d={path} stroke="rgba(255,255,255,0.08)" strokeWidth="1" fill="none" className="transition-all duration-500" />;
            })}
          </svg>

          {nodes.filter(isVisible).map(node => (
            <div 
              key={node.id} 
              className={`absolute transition-all duration-300 ${selectedNodeId === node.id ? "z-50" : "z-10"}`} 
              style={{ left: node.x, top: node.y }}
              onMouseDown={(e) => handleMouseDown(node.id, e)}
              onClick={(e) => {
                e.stopPropagation();
                if (hasMoved) return;
                if (node.type === 'category' || node.type === 'triage') toggleExpand(node.id);
                else setSelectedNodeId(node.id);
              }}
            >
              <div className={`p-3 rounded-2xl backdrop-blur-3xl border transition-all ${selectedNodeId === node.id ? "bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.1)]" : "bg-white/5 border-white/5 hover:border-white/10"}`}>
                <div className="flex items-center gap-3 min-w-[140px]">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-black/40 border border-white/5 text-white/70">
                    {getIcon(node.type, node.isExpanded)}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h3 className="text-[14px] font-bold text-white uppercase truncate">{node.label}</h3>
                    {node.description && <p className="text-[12px] text-white/40 truncate">{node.description}</p>}
                    {node.classification && (
                      <div className="mt-1 flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${getClassificationColor(node.classification)}`} />
                        <span className="text-[9px] text-white/30 uppercase">{node.classification}</span>
                      </div>
                    )}
                  </div>
                  {(node.type === 'category' || node.type === 'triage') && (
                    <div className="text-white/20">
                      {node.isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* DETAILS SIDEBAR */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div 
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              className="absolute top-10 right-10 w-80 p-6 rounded-3xl bg-black/80 border border-white/10 backdrop-blur-3xl shadow-2xl z-[300] max-h-[85%] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between mb-6">
                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                  Detalhes do Ativo
                </span>
                <button onClick={() => setSelectedNodeId(null)} className="text-white/20 hover:text-white transition-colors">
                  <X size={20}/>
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white leading-tight uppercase">{selectedNode.label}</h2>
                  <p className="text-[9px] text-emerald-500/60 font-bold mt-1 uppercase tracking-widest">{selectedNode.type}</p>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                  {selectedNode.type === "root" ? (
                    <div className="space-y-3">
                      <div className="flex justify-between text-[10px] uppercase">
                        <span className="text-white/30">CPF:</span>
                        <span className="text-white">{data.patient.documento}</span>
                      </div>
                      <div className="flex justify-between text-[10px] uppercase">
                        <span className="text-white/30">Sexo:</span>
                        <span className="text-white">{data.patient.sexo || "Não informado"}</span>
                      </div>
                      <div className="flex justify-between text-[10px] uppercase">
                        <span className="text-white/30">Nascimento:</span>
                        <span className="text-white">{new Date(data.patient.data_nascimento).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedNode.description && (
                         <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-[10px] text-white/70 leading-relaxed">
                            {selectedNode.description}
                         </div>
                      )}
                      {selectedNode.classification && (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-white/30 uppercase">Classificação</span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${getClassificationColor(selectedNode.classification)} text-white`}>
                            {selectedNode.classification}
                          </span>
                        </div>
                      )}
                      
                      {/* Triage Specific Symptoms list in sidebar */}
                      {selectedNode.details?.sintomas && selectedNode.details.sintomas.length > 0 && (
                        <div className="pt-2 border-t border-white/5">
                           <p className="text-[9px] text-white/40 uppercase mb-2">Sintomas Identificados:</p>
                           <div className="flex flex-wrap gap-1">
                              {selectedNode.details.sintomas.map((s: any, idx: number) => (
                                 <span key={idx} className="bg-white/5 px-1.5 py-0.5 rounded text-[8px] text-white/60">
                                    {s.nome || s}
                                 </span>
                              ))}
                           </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-4">
                  <button 
                    onClick={() => setSelectedNodeId(null)}
                    className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                  >
                    Voltar ao Mapa
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
