"use client";

import { m } from "motion/react";
import Image from "next/image";

export function LoadingScreen() {
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
            <div className="relative flex flex-col items-center gap-8">
                {/* Ambient Glows */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-green-500/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150px] h-[150px] bg-green-500/20 rounded-full blur-[60px] pointer-events-none" />

                <m.div
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{
                        scale: [1, 1.05, 1],
                        opacity: 1
                    }}
                    transition={{
                        scale: {
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                        },
                        opacity: {
                            duration: 0.5
                        }
                    }}
                    className="relative z-10"
                >
                    <div className="relative">
                        {/* Pulsing ring around logo */}
                        <m.div
                            animate={{
                                scale: [1, 1.4, 1],
                                opacity: [0.3, 0, 0.3]
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "linear"
                            }}
                            className="absolute inset-0 rounded-full border border-green-500/30"
                        />

                        <Image
                            src="/nosana.png"
                            alt="Nosana"
                            width={100}
                            height={100}
                            className="relative z-10 drop-shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all duration-300"
                            priority
                        />
                    </div>
                </m.div>

                <m.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.8 }}
                    className="flex flex-col items-center gap-4 text-center z-10"
                >
                    <div className="space-y-1">
                        <h2 className="text-2xl font-bold tracking-[0.2em] text-foreground/90 uppercase">
                            Nosana <span className="text-green-500">Chat</span>
                        </h2>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-[0.3em] opacity-60">
                            Initializing AI Engine
                        </p>
                    </div>

                    <div className="flex gap-2.5 mt-2">
                        {[0, 1, 2].map((i) => (
                            <m.div
                                key={i}
                                animate={{
                                    scale: [1, 1.5, 1],
                                    opacity: [0.3, 1, 0.3],
                                }}
                                transition={{
                                    duration: 1,
                                    repeat: Infinity,
                                    delay: i * 0.2,
                                    ease: "easeInOut"
                                }}
                                className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"
                            />
                        ))}
                    </div>
                </m.div>
            </div>

            {/* Background patterns */}
            <div className="absolute inset-0 bg-[url('/grid.png')] bg-[length:40px_40px] opacity-[0.03] pointer-events-none" />
        </div>
    );
}
