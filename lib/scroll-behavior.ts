// scrollIntoView({ behavior: "smooth" }) ignores the CSS
// `@media (prefers-reduced-motion: reduce)` guard on `scroll-behavior` —
// passing an explicit behavior always overrides it. Callers that want a
// smooth scroll should ask this for the behavior instead of hardcoding it.
export function getScrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined") return "auto";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
