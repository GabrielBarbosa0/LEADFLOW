import {
  Armchair,
  Archive,
  ArrowLeft,
  BarChart3,
  BellRing,
  BrushCleaning,
  Building2,
  BusFront,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarX,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleMinus,
  CirclePlus,
  CircleX,
  ClipboardList,
  ClipboardX,
  Clock3,
  CloudCheck,
  Copy,
  Download,
  Ellipsis,
  Eye,
  FileDown,
  Filter,
  FlaskConical,
  HardDrive,
  House,
  Info,
  KeyRound,
  LayoutDashboard,
  LogIn,
  LogOut,
  LoaderCircle,
  ListPlus,
  MapPin,
  MapPinned,
  Megaphone,
  MessageCircle,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Repeat2,
  RotateCcw,
  Route,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Stethoscope,
  Target,
  Trash2,
  TriangleAlert,
  Trophy,
  UserPlus,
  UserRound,
  UserRoundCog,
  UserRoundSearch,
  UserRoundX,
  Users,
  UsersRound,
  Wifi,
  WifiOff,
  Wrench,
  X,
  createIcons
} from 'lucide';
import { escapeHtml } from './formatters.js';

const appIcons = {
  Armchair,
  Archive,
  ArrowLeft,
  BarChart3,
  BellRing,
  BrushCleaning,
  Building2,
  BusFront,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarX,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleMinus,
  CirclePlus,
  CircleX,
  ClipboardList,
  ClipboardX,
  Clock3,
  CloudCheck,
  Copy,
  Download,
  Ellipsis,
  Eye,
  FileDown,
  Filter,
  FlaskConical,
  HardDrive,
  House,
  Info,
  KeyRound,
  LayoutDashboard,
  LogIn,
  LogOut,
  LoaderCircle,
  ListPlus,
  MapPin,
  MapPinned,
  Megaphone,
  MessageCircle,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Repeat2,
  RotateCcw,
  Route,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Stethoscope,
  Target,
  Trash2,
  TriangleAlert,
  Trophy,
  UserPlus,
  UserRound,
  UserRoundCog,
  UserRoundSearch,
  UserRoundX,
  Users,
  UsersRound,
  Wifi,
  WifiOff,
  Wrench,
  X
};

export function renderIcons() {
  createIcons({ icons: appIcons });
}

export function toastMarkup({ message = '', tone = 'success', icon = 'circle-check' } = {}) {
  return `<div class="toast toast-${escapeHtml(tone)}" role="status"><i data-lucide="${escapeHtml(icon)}"></i><span>${escapeHtml(message)}</span></div>`;
}

export function connectivityMarkup(online) {
  return `<i data-lucide="${online ? 'wifi' : 'wifi-off'}"></i>${online ? 'Online' : 'Offline'}`;
}

export function syncConnectivityIndicator() {
  const indicator = document.querySelector('.connectivity');
  if (!indicator) return;
  const online = navigator.onLine;
  indicator.classList.toggle('is-online', online);
  indicator.classList.toggle('is-offline', !online);
  indicator.innerHTML = connectivityMarkup(online);
  renderIcons();
}

export function createToastController(state, options = {}) {
  const duration = options.duration ?? 3200;
  const rootSelector = options.rootSelector || '#app';
  const renderToastIcons = options.renderIcons || renderIcons;
  let timeoutId = null;

  return function showToast(message, tone = 'success', icon = 'circle-check') {
    state.toast = { message, tone, icon };
    clearTimeout(timeoutId);
    const root = document.querySelector(rootSelector);
    root?.querySelector('.toast')?.remove();
    root?.insertAdjacentHTML('beforeend', toastMarkup(state.toast));
    renderToastIcons();
    timeoutId = setTimeout(() => {
      state.toast = null;
      document.querySelector(`${rootSelector} .toast`)?.remove();
      timeoutId = null;
    }, duration);
  };
}
