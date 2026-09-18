import React from 'react';
import { Users } from 'lucide-react';

interface AvatarProps {
  name: string;
  url?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  status?: 'online' | 'away' | 'offline';
  className?: string;
  showChangeOverlay?: boolean;
  onChangeClick?: () => void;
  accentColor?: string;
  isGroup?: boolean;
}

export const getInitials = (name: string): string => {
  if (!name) return '?';
  const clean = name.replace(/[^\w\s]/gi, '').trim();
  if (!clean) return name.slice(0, 1).toUpperCase();
  const parts = clean.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
  '2xl': 'w-24 h-24 text-3xl',
};

const statusSizeClasses = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-3.5 h-3.5',
  '2xl': 'w-5 h-5',
};

export const Avatar: React.FC<AvatarProps> = ({
  name,
  url,
  size = 'md',
  status,
  className = '',
  showChangeOverlay = false,
  onChangeClick,
  isGroup = false,
}) => {
  const [hasImgError, setHasImgError] = React.useState(false);
  const initials = getInitials(name);

  // Gradient seeds based on name
  const gradients = [
    'from-pink-500 to-purple-600',
    'from-cyan-500 to-blue-600',
    'from-purple-500 to-indigo-600',
    'from-emerald-400 to-teal-600',
    'from-rose-500 to-pink-600',
    'from-violet-500 to-fuchsia-600',
  ];
  const charCodeSum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const gradient = gradients[charCodeSum % gradients.length];

  const hasValidImage = url && url.trim() !== '' && !hasImgError;

  return (
    <div
      className={`relative shrink-0 select-none rounded-2xl ${sizeClasses[size]} ${className}`}
      onClick={onChangeClick}
    >
      {hasValidImage ? (
        <img
          src={url}
          alt={name}
          onError={() => setHasImgError(true)}
          className={`w-full h-full object-cover rounded-2xl border border-white/10 ${
            showChangeOverlay ? 'cursor-pointer' : ''
          }`}
        />
      ) : isGroup ? (
        <div
          className="w-full h-full rounded-2xl bg-gradient-to-tr from-cyan-600 to-purple-600 flex items-center justify-center font-bold text-white border border-white/15 shadow-inner"
        >
          <Users className="w-1/2 h-1/2 text-cyan-200" />
        </div>
      ) : (
        <div
          className={`w-full h-full rounded-2xl bg-gradient-to-tr ${gradient} flex items-center justify-center font-bold font-display text-white border border-white/15 shadow-inner`}
        >
          <span>{initials}</span>
        </div>
      )}

      {/* Change Photo Overlay */}
      {showChangeOverlay && (
        <div
          className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer p-1 text-center"
        >
          <span className="text-[10px] font-semibold text-pink-300 leading-none">
            Change
          </span>
          <span className="text-[9px] text-slate-300">Photo</span>
        </div>
      )}

      {/* Status indicator dot */}
      {status && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-[#0a0d14] ${
            statusSizeClasses[size]
          } ${
            status === 'online'
              ? 'bg-emerald-400'
              : status === 'away'
              ? 'bg-amber-400'
              : 'bg-slate-500'
          }`}
        />
      )}
    </div>
  );
};
