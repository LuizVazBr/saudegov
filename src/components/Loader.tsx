"use client";

import Image from "next/image";

interface LoaderProps {
  isDark: boolean; // ✅ recebendo do ThemeProvider
}

export default function Loader({ isDark }: LoaderProps) {
  return (
    <div
      className={`fixed inset-0 flex items-center justify-center z-50 transition-colors duration-300 ${isDark ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"
        }`}
    >
      <div className="text-center">
        <Image
          src="/cliv.png"
          alt="logo"
          width={120}
          height={120}
          className="mx-auto mb-6"
          style={{ width: "auto", height: "auto" }}
          priority
        />

        <div className="flex justify-center gap-2">
          <span
            className={`w-3 h-3 rounded-full ${isDark ? "bg-white" : "bg-gray-900"
              } animate-loader-delay0`}
          />
          <span
            className={`w-3 h-3 rounded-full ${isDark ? "bg-white" : "bg-gray-900"
              } animate-loader-delay1`}
          />
          <span
            className={`w-3 h-3 rounded-full ${isDark ? "bg-white" : "bg-gray-900"
              } animate-loader-delay2`}
          />
          <span
            className={`w-3 h-3 rounded-full ${isDark ? "bg-white" : "bg-gray-900"
              } animate-loader-delay3`}
          />
        </div>
      </div>
    </div>
  );
}
