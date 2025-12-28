"use client";


// Wait, user doesn't have framer-motion. I'll use pure CSS + React.

import React from "react";

export default function Template({ children }: { children: React.ReactNode }) {
    return (
        <div className="animate-fade-in-up">
            {children}
        </div>
    );
}
