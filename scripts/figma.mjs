// Figma REST API integration helper for CitaLink
import fs from 'fs';

const FIGMA_TOKEN = process.env.FIGMA_TOKEN || '';

export async function getFigmaFile(fileKey, depth = 2) {
    const res = await fetch(`https://api.figma.com/v1/files/${fileKey}?depth=${depth}`, {
        headers: { 'X-Figma-Token': FIGMA_TOKEN }
    });
    if (!res.ok) throw new Error(`Figma API error: ${res.status} ${await res.text()}`);
    return await res.json();
}

export async function getFigmaNodes(fileKey, ids = []) {
    const idsParam = ids.join(',');
    const res = await fetch(`https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(idsParam)}`, {
        headers: { 'X-Figma-Token': FIGMA_TOKEN }
    });
    if (!res.ok) throw new Error(`Figma API error: ${res.status} ${await res.text()}`);
    return await res.json();
}

export async function getFigmaImage(fileKey, ids = [], format = 'png', scale = 2) {
    const idsParam = ids.join(',');
    const res = await fetch(`https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(idsParam)}&format=${format}&scale=${scale}`, {
        headers: { 'X-Figma-Token': FIGMA_TOKEN }
    });
    if (!res.ok) throw new Error(`Figma API error: ${res.status} ${await res.text()}`);
    return await res.json();
}

// CLI usage if invoked directly
if (process.argv[1] && process.argv[1].includes('figma.mjs')) {
    const action = process.argv[2] || 'info';
    const fileKey = process.argv[3] || 'N3UFRj0jw3Lk9MNNoEGbB0';
    if (action === 'info') {
        getFigmaFile(fileKey).then(data => {
            console.log(`Figma File: ${data.name} (last modified: ${data.lastModified})`);
            console.log(`Pages:`, data.document.children.map(c => `${c.name} (ID: ${c.id})`));
        }).catch(err => console.error(err));
    }
}
