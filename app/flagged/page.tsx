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

    const pageRaw = sp.page;
    const page = Math.max(1, parseInt(Array.isArray(pageRaw) ? pageRaw[0] : (pageRaw ?? "1"), 10) || 1);

    const db = await getMongoDb();
    const mongoReady = Boolean(db);

    const { records, total, totalPages } = await queryFlaggedSites({ q, page, limit: 12 });

    return (
        <div className="min-h-screen bg-[var(--bg)]">
            <NavbarWrapper subtitle="Threat Database" />
            <FlaggedClient
                flagged={records}
                q={q}
                mongoReady={mongoReady}
                page={page}
                totalPages={totalPages}
                total={total}
            />
        </div>
    );
}
