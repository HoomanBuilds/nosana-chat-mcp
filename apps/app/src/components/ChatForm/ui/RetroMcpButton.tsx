import { cn } from '@/lib/utils';
import React from 'react'

const RetroMcpButton = ({ onClick, children , className}: { onClick: () => void; children: React.ReactNode , className? : string }) => {
    return (
        <div className={cn("mb-2 px-3 h-fit" , className)}>
            <button
                onClick={onClick}
                className="retro-btn w-full text-[1rem] px-3 py-2 border-2 border-[#2f2e2a] bg-green-600
                text-white shadow-[4px_4px_0_#2f2e2a] hover:shadow-[0px_0px_0_#2f2e2a]
                hover:scale-[1.1] hover:border-0
                transition-all duration-100 ease-in
                focus-visible:outline-dotted focus-visible:outline-[#2f2e2a]
                flex justify-center
                hover:cursor-pointer relative"
            >

                {children}
            </button>
        </div>
    );
};

export default RetroMcpButton