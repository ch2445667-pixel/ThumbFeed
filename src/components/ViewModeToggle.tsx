'use client';

import React from 'react';
import { LayoutGrid, Images } from 'lucide-react';
import { SlidingTabs } from './SlidingTabs';

interface ViewModeToggleProps {
  isDetail: boolean;
  onToggle: () => void;
  className?: string;
}

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({
  isDetail,
  onToggle,
  className = '',
}) => {
  return (
    <SlidingTabs
      items={[
        { key: 'details', label: 'Details', icon: LayoutGrid },
        { key: 'compact', label: 'Compact', icon: Images },
      ]}
      value={isDetail ? 'details' : 'compact'}
      onChange={(key) => {
        const nextDetail = key === 'details';
        if (nextDetail !== isDetail) onToggle();
      }}
      ariaLabel="Thumbnail display mode"
      className={className}
    />
  );
};

export default ViewModeToggle;