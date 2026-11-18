// Calculs lourds de la lecture de partition, hors du fil principal.
importScripts('omr.js');
onmessage = e => {
  const { type, g, w, h, id } = e.data;
  try {
    if (type === 'angle') postMessage({ id, angle: OMR.analyzeGray(g, w, h).angle });
    else if (type === 'analyze') {
      const r = OMR.analyzeStraight(g, w, h);
      postMessage({ id, res: { staves: r.staves, box: r.box, heads: r.heads.map(x => ({ x: x.x, y: x.y, staff: x.staff, hollow: x.hollow, flags: x.flags, dots: x.dots, stem: x.stem ? { dir: x.stem.dir, len: x.stem.len } : null })) } });
    }
  } catch (err) { postMessage({ id, error: String(err) }); }
};
