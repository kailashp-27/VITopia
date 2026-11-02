// Keep a typed answer paired with its own session/image. Manual mode never
// invokes the reader, including after a rejected answer or an expired image.
export async function prepareVerification({
  challenge,
  answer,
  manual,
  load,
  read,
  now = Date.now,
}) {
  const reusable = challenge && challenge.expiresAt > now();
  const active = reusable ? challenge : await load();
  const typed = reusable ? answer.trim() : "";
  if (manual) {
    if (!reusable || !/^[A-Z0-9]{6}$/i.test(typed))
      return { challenge: active, needsManual: true };
    return { challenge: active, answer: typed.toUpperCase() };
  }
  let prediction;
  try {
    prediction = await read(active.image);
  } catch {
    // A failed reader still leaves the image available for manual entry.
  }
  if (!prediction?.reliable || !/^[A-Z0-9]{6}$/i.test(prediction.text || ""))
    return { challenge: active, needsManual: true };
  return { challenge: active, answer: prediction.text.toUpperCase() };
}
