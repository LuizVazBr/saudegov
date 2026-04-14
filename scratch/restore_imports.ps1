$path = "c:\Cliv\Backup outro notebook\cliv-telemedicina\anamnex-app\src\components\RealTimeDashboard.tsx"
$missingBlock = @'
"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Activity, ArrowRight, Brain, Circle, ClipboardList, History as HistoryIcon,
  Map as MapIcon, Maximize2, Menu, MonitorPlay, Moon, Play, Shield, Sun, X, Settings, 
  LocateFixed, Crosshair, ZoomIn, Info, Save, MapPin, User, ShieldAlert, Phone, Bot, Send, Mic, Loader2, ScrollText, Home, AlertTriangle, Search
} from "lucide-react";
import { useTheme } from "next-themes";
import { jsPDF } from "jspdf";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

const MapComponent = dynamic(() => import("./MapComponentPremium"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-200 dark:bg-[#0c0e14] animate-pulse" />
  )
});

'@

$currentContent = Get-Content $path -Raw
$newContent = $missingBlock + "`n" + $currentContent
$newContent | Set-Content $path -Encoding UTF8
