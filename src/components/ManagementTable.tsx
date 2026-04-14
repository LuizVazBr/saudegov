"use client";

import { FiEdit2, FiTrash2, FiSearch, FiPlus, FiAlertCircle } from "react-icons/fi";

interface ManagementTableProps {
  title: string;
  data: any[];
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  loading: boolean;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  addButtonLabel: string;
  columns: { key: string; label: string; render?: (item: any) => React.ReactNode }[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  renderCustomActions?: (item: any) => React.ReactNode;
}

export default function ManagementTable({
  title,
  data,
  onEdit,
  onDelete,
  onAdd,
  loading,
  searchTerm,
  onSearchChange,
  addButtonLabel,
  columns,
  onLoadMore,
  hasMore,
  renderCustomActions,
}: ManagementTableProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-xl font-bold dark:text-white">{title}</h2>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar..."
              className="pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition w-full md:w-64"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <button
            onClick={onAdd}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold shadow transition whitespace-nowrap"
          >
            <FiPlus /> {addButtonLabel}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400 text-xs uppercase font-bold">
                {columns.map((col) => (
                  <th key={col.key} className="p-4 whitespace-nowrap">{col.label}</th>
                ))}
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading && data.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {columns.map((col) => (
                      <td key={col.key} className="p-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                      </td>
                    ))}
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded" />
                        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="p-12 text-center text-gray-500">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                    {columns.map((col) => (
                      <td key={col.key} className="p-4 text-gray-700 dark:text-gray-200 text-sm">
                        {col.render ? col.render(item) : item[col.key] || "—"}
                      </td>
                    ))}
                    <td className="p-4 text-right">
                        <div className="flex justify-end gap-1">
                          {renderCustomActions && renderCustomActions(item)}
                          <button
                            onClick={() => onEdit(item)}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition"
                            title="Editar"
                          >
                            <FiEdit2 size={18} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Tem certeza que deseja excluir?")) {
                                onDelete(item.id);
                              }
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                            title="Excluir"
                          >
                            <FiTrash2 size={18} />
                          </button>
                        </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {hasMore && (
        <button
          onClick={onLoadMore}
          disabled={loading}
          className="w-full py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition font-medium disabled:opacity-50"
        >
          {loading ? "Carregando..." : "Ver mais"}
        </button>
      )}
    </div>
  );
}
