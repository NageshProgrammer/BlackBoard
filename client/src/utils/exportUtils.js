/**
 * Export utilities for Whiteboard: PNG, SVG, and JSON
 */

export const exportCanvasAsPNG = (canvasElement, roomName = 'Whiteboard') => {
  if (!canvasElement) return;

  try {
    const dataUrl = canvasElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${roomName.replace(/\s+/g, '_')}_export.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Error exporting PNG:', err);
  }
};

export const exportCanvasAsJSON = (elements, roomName = 'Whiteboard') => {
  try {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(elements, null, 2));
    const link = document.createElement('a');
    link.download = `${roomName.replace(/\s+/g, '_')}_export.json`;
    link.href = dataStr;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Error exporting JSON:', err);
  }
};

export const exportCanvasAsSVG = (elements, roomName = 'Whiteboard') => {
  try {
    let svgInner = '';
    const activeElements = Object.values(elements);

    activeElements.forEach((el) => {
      const d = el.data || {};
      if (el.type === 'rectangle') {
        svgInner += `<rect x="${d.x}" y="${d.y}" width="${d.width}" height="${d.height}" fill="${d.fill || 'none'}" stroke="${d.stroke || '#000'}" stroke-width="${d.strokeWidth || 2}" rx="4"/>\n`;
      } else if (el.type === 'circle') {
        const cx = d.x + (d.width || 100) / 2;
        const cy = d.y + (d.height || 100) / 2;
        const rx = Math.abs((d.width || 100) / 2);
        const ry = Math.abs((d.height || 100) / 2);
        svgInner += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${d.fill || 'none'}" stroke="${d.stroke || '#000'}" stroke-width="${d.strokeWidth || 2}"/>\n`;
      } else if (el.type === 'stroke' && Array.isArray(d.points) && d.points.length > 1) {
        const pathData = d.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        svgInner += `<path d="${pathData}" fill="none" stroke="${d.stroke || '#000'}" stroke-width="${d.strokeWidth || 2}" stroke-linecap="round" stroke-linejoin="round"/>\n`;
      } else if (el.type === 'text') {
        svgInner += `<text x="${d.x}" y="${d.y + (d.fontSize || 20)}" fill="${d.fill || '#fff'}" font-size="${d.fontSize || 20}" font-family="sans-serif">${d.text || ''}</text>\n`;
      } else if (el.type === 'line' || el.type === 'arrow') {
        svgInner += `<line x1="${d.x1}" y1="${d.y1}" x2="${d.x2}" y2="${d.y2}" stroke="${d.stroke || '#000'}" stroke-width="${d.strokeWidth || 2}" stroke-linecap="round"/>\n`;
      }
    });

    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
      <rect width="100%" height="100%" fill="#0b0f19"/>
      ${svgInner}
    </svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${roomName.replace(/\s+/g, '_')}_export.svg`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Error exporting SVG:', err);
  }
};
