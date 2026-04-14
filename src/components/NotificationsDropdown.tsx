"use client";

import { useState, useRef, useEffect } from "react";
import { FiBell, FiX } from "react-icons/fi";

export interface Notification {
  id: number;
  icon?: React.ReactNode;
  text: string;
  datetime: string;
}

interface NotificationsDropdownProps {
  notifications: Notification[];
}

export default function NotificationsDropdown({ notifications }: NotificationsDropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botão sino */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        title="Notificações"
      >
        <FiBell size={20} className="dark:text-gray-200" />
        {notifications.length > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-red-500 rounded-full">
            {notifications.length}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 min-w-[300px] max-w-[500px] w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
            <span className="font-semibold text-gray-900 dark:text-gray-100">Notificações</span>
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition">
              <FiX size={16} className="text-gray-600 dark:text-gray-200" />
            </button>
          </div>

          {/* Lista de notificações */}
          <div className="flex flex-col max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">Nenhuma notificação</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className="flex items-start p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer"
                >
                  <div className="flex-shrink-0 mr-3">
                    {n.icon || <FiBell size={32} className="rounded-full bg-gray-200 dark:bg-gray-700 p-1" />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{n.text}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">{n.datetime}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Fechar */}
          <div className="p-2 border-t border-gray-200 dark:border-gray-700 text-center">
            <button
              onClick={() => setOpen(false)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
