"use client";

import { Navbar } from "./Navbar";

export function NavbarWrapper({
    subtitle,
    flaggedCount,
}: {
    subtitle?: string;
    flaggedCount?: number;
}) {
    return <Navbar subtitle={subtitle} flaggedCount={flaggedCount} />;
}
