import React from 'react';

interface TacButtonProps {
  onClick?: () => void;
  active?: boolean;
  variant?: 'primary' | 'danger' | 'neutral';
  className?: string;
  children: React.ReactNode;
}

export const TacButton: React.FC<TacButtonProps> = ({ 
  onClick, 
  active, 
  variant = 'primary', 
  className = '', 
  children 
}) => {
  const baseClass = 'border font-mono uppercase transition-colors';
  const variantClass = {
    primary: active ? 'bg-green-700 text-white border-green-500' : 'bg-black text-green-500 border-green-800 hover:bg-green-900',
    danger: 'bg-red-900 text-white border-red-500 hover:bg-red-700',
    neutral: 'bg-gray-900 text-gray-300 border-gray-700 hover:bg-gray-800'
  }[variant];

  return (
    <button onClick={onClick} className={`${baseClass} ${variantClass} ${className} px-2 py-1`}>
      {children}
    </button>
  );
};

interface TacSliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  step?: number;
}

export const TacSlider: React.FC<TacSliderProps> = ({ min, max, value, onChange, step = 1 }) => {
  return (
    <input 
      type="range" 
      min={min} 
      max={max} 
      step={step} 
      value={value} 
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-2 bg-black border border-green-800 appearance-none slider-thumb"
    />
  );
};

interface TacBoxProps {
  title: string;
  className?: string;
  children: React.ReactNode;
}

export const TacBox: React.FC<TacBoxProps> = ({ title, className = '', children }) => {
  return (
    <div className={`border border-green-800 bg-[#051005] p-2 ${className}`}>
      <div className="text-xs font-bold text-green-600 mb-1 border-b border-green-900">{title}</div>
      {children}
    </div>
  );
};