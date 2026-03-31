import React from 'react';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: 'blue' | 'green' | 'red' | 'purple';
}

const bgColors = {
  blue: 'bg-blue-100',
  green: 'bg-green-100',
  red: 'bg-red-100',
  purple: 'bg-purple-100',
};

export const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color }) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className={`p-3 ${bgColors[color]} rounded-lg`}>
          {icon}
        </div>
      </div>
    </div>
  );
};