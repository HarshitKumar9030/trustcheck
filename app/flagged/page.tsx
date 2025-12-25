import { getMongoDb } from "../../lib/mongo";
import { queryFlaggedSites } from "../../lib/flaggedSites";
import { NavbarWrapper } from "@/app/components/NavbarWrapper";
import { FlaggedClient } from "./FlaggedClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FlaggedPage({
    searchParams,
}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
    const sp = (await searchParams) ?? {};
    const qRaw = sp.q;
    const q = Array.isArray(qRaw) ? qRaw[0] : (qRaw ?? "");

    const db = await getMongoDb();
    const mongoReady = Boolean(db);

    const flagged = await queryFlaggedSites({ q, limit: 60 });

    return (
        <div className="min-h-screen bg-[#FDFDFD]">
            <NavbarWrapper subtitle="Threat Database" />
            <FlaggedClient flagged={flagged} q={q} mongoReady={mongoReady} />
        </div>
    );
}
