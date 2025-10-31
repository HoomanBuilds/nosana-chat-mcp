// import { NextRequest, NextResponse } from "next/server";
// import { kv } from "@vercel/kv";
// import { Modes } from "@nosana-chat/ai";

// interface CreditInterface {
//     manageCredits: (req: NextRequest, userId?: string) => Promise<number>;
//     checkIPbasedCredit: (ip: string) => Promise<number>;
//     deductCredits: (userKey: string, mode: Modes.ChatMode) => Promise<number>;
// }

// export class Credit implements CreditInterface {
//     private AUTH_LIMIT = 30;
//     private IP_LIMIT = 10;

//     constructor() { }

//     async manageCredits(req: NextRequest, userId?: string): Promise<number> {
//         let creditAvailable = 0;

//         if (userId) {
//             const userKey = `user:ID:${userId}`;
//             creditAvailable = await this.checkAuthenticatedCredits(userKey);
//         } else {
//             const ip = req.headers.get("x-forwarded-for") || "";
//             if (!ip) {
//                 throw NextResponse.json(
//                     { error: "IP Undetected - you are Unimaginable" },
//                     { status: 500 }
//                 );
//             }
//             const ipKey = `user:IP:${ip}`;
//             creditAvailable = await this.checkIPbasedCredit(ipKey);
//         }

//         return creditAvailable;
//     }

//     private async checkAuthenticatedCredits(userKey: string): Promise<number> {
//         const today = new Date().toISOString().slice(0, 10);
//         const key = `${userKey}:${today}`;

//         let credits = await kv.get<number>(key);

//         if (credits === null) {
//             await kv.set(key, this.AUTH_LIMIT, { ex: 60 * 60 * 24 });
//             credits = this.AUTH_LIMIT;
//         }

//         return credits;
//     }

//     public async checkIPbasedCredit(ipKey: string): Promise<number> {
//         const today = new Date().toISOString().slice(0, 10);
//         const key = `${ipKey}:${today}`;

//         let credits = await kv.get<number>(key);

//         if (credits === null) {
//             await kv.set(key, this.IP_LIMIT, { ex: 60 * 60 * 24 });
//             credits = this.IP_LIMIT;
//         }

//         return credits;
//     }



//     public async deductCredits(key: string, mode: Modes.ChatMode): Promise<number> {


//         const today = new Date().toISOString().slice(0, 10);
//         const dailyKey = `${key}:${today}`;

//         let credits = await kv.get<number>(dailyKey);
//         if (credits === null) {
//             credits = key.startsWith("user:ID:") ? this.AUTH_LIMIT : this.IP_LIMIT;
//             await kv.set(dailyKey, credits, { ex: 60 * 60 * 24 });
//         }

//         const cost = Modes.CHAT_MODE_CREDIT_COSTS[mode] ?? 1;

//         const newCredits = Math.max(0, credits - cost);
//         await kv.set(dailyKey, newCredits, { ex: 60 * 60 * 24 });

//         return newCredits;
//     }
// }
