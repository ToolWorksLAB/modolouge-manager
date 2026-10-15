// Product is explicitly reported by each demo, never inferred from shared tools.
export function demoProductLabel(events = {}) {
  const insole = events.viewed_insole > 0, cast = events.viewed_cast > 0;
  return insole && cast ? "Insole + Cast" : insole ? "Insole" : cast ? "Cast / wrist splint" : "Not recorded";
}
