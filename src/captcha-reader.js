// Fixed-layout VTOP image classifier adapted from the MIT-licensed project
// levyashvin/VTOP-Captcha-Solver. See vendor/VTOP-SOLVER-LICENSE.txt.
export const LABELS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function predictGlyph(input, model) {
  if (
    input.length !== 528 ||
    model.weights.length !== 528 ||
    model.biases.length !== LABELS.length
  )
    throw new Error("Unsupported captcha model");
  const scores = [...model.biases];
  for (let row = 0; row < input.length; row++)
    for (let col = 0; col < scores.length; col++)
      scores[col] += input[row] * model.weights[row][col];
  const highest = Math.max(...scores);
  const exp = scores.map((score) => Math.exp(score - highest));
  const sum = exp.reduce((a, b) => a + b, 0);
  const ranked = exp
    .map((value, index) => ({ value: value / sum, index }))
    .sort((a, b) => b.value - a.value);
  return {
    text: LABELS[ranked[0].index],
    confidence: ranked[0].value,
    margin: ranked[0].value - ranked[1].value,
  };
}
export function decodePixels(rgba, model) {
  if (rgba.length !== 200 * 40 * 4)
    throw new Error("Unsupported captcha dimensions");
  const saturation = new Float32Array(200 * 40);
  let ink = 0;
  for (let i = 0; i < saturation.length; i++) {
    const r = rgba[i * 4],
      g = rgba[i * 4 + 1],
      b = rgba[i * 4 + 2];
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    saturation[i] = max ? Math.round(((max - min) * 255) / max) : 0;
    if (saturation[i] > 100) ink++;
  }
  if (ink < 60) return null;
  const glyphs = [];
  for (let i = 0; i < 6; i++) {
    const left = (i + 1) * 25 + 2,
      top = 8 + 5 * (i % 2);
    const pixels = [];
    for (let y = top; y < top + 22; y++)
      for (let x = left; x < left + 24; x++)
        pixels.push(saturation[y * 200 + x]);
    const mean = pixels.reduce((a, b) => a + b, 0) / pixels.length;
    glyphs.push(
      predictGlyph(
        pixels.map((value) => (value > mean ? 1 : 0)),
        model,
      ),
    );
  }
  return {
    text: glyphs.map((g) => g.text).join(""),
    confidence: Math.min(...glyphs.map((g) => g.confidence)),
    reliable: glyphs.every((g) => g.confidence >= 0.7 && g.margin >= 0.3),
  };
}
export async function readCaptcha(
  source,
  { signal, onProgress = () => {} } = {},
) {
  if (!/^data:image\/(png|jpe?g);base64,[a-zA-Z0-9+/=]+$/.test(source))
    throw new Error("Unsupported captcha image");
  signal?.throwIfAborted();
  onProgress("Reading VTOP verification…");
  const [{ default: model }, image] = await Promise.all([
    import("./vendor/vtop-model.json"),
    (async () => {
      const img = new Image();
      img.src = source;
      await img.decode();
      return img;
    })(),
  ]);
  signal?.throwIfAborted();
  if (Math.abs(image.naturalWidth / image.naturalHeight - 5) > 0.2) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 200;
  canvas.height = 40;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, 200, 40);
  return decodePixels(context.getImageData(0, 0, 200, 40).data, model);
}
