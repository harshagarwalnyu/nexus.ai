import { tableFromIPC } from "apache-arrow";

export async function fetchArrowData(url, key) {
    try {
        const response = await fetch(`${url}/get`, {
            method: 'POST',
            body: JSON.stringify({ key })
        });

        if (!response.ok) throw new Error(`Failed to fetch Arrow data: ${response.statusText}`);

        const buffer = await response.arrayBuffer();
        const table = tableFromIPC(new Uint8Array(buffer));
        return table;
    } catch (err) {
        console.error("[ArrowClient] Error:", err.message);
        throw err;
    }
}

export function arrowToJson(table) {
    return table.toArray().map(row => row.toJSON());
}