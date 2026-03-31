import React from 'react';

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
}

export const TabButton: React.FC<TabButtonProps> = ({ active, onClick, label }) => {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-3 font-medium ${
        active
          ? 'border-b-2 border-blue-600 text-blue-600'
          : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      {label}
    </button>
  );
};