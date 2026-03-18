import React from 'react';
import '@/app/restaurant/restaurant.css';

export default function RestaurantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="res-body min-h-screen p-6">
      <div className="max-w-[1600px] mx-auto">
        {children}
      </div>
    </div>
  );
}
