import { Metadata } from "next";
import TestPageClient from "./TestPageClient";

export const metadata: Metadata = {
    title: "Nosana Chat | Test",
    description: "Internal testing page",
};

export default function Page() {
    return <TestPageClient />;
}
