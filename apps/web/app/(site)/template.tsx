"use client";

import React from "react";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-transition motion-reduce:animate-none min-h-screen">
      {children}
    </div>
  );
}
