import { ReactNode } from "react";

export default function Template({ children }: { children: ReactNode }) {
    return (
        <div className="animate-fade-in motion-reduce:animate-none">
            {children}
        </div>
    );
}
