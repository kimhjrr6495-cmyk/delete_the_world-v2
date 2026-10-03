// Small world objects, shared by the starting choices and skill sockets.
const shapes = {
  overcharge: '<path d="M27 4 12 24h11l-4 20 17-25H25Z"/><path class="icon-detail" d="m8 13 5 3M37 33l5 3M9 35l5-3"/>',
  bomb: '<circle cx="24" cy="25" r="11"/><circle class="icon-core" cx="24" cy="25" r="4"/><path d="m22 14 2-7 7-2M12 12l3 3M35 14l3-3M8 27h4M36 27h5M17 39l-2 4M31 39l2 4"/>',
  hole: '<ellipse cx="24" cy="24" rx="18" ry="8" transform="rotate(-28 24 24)"/><circle cx="24" cy="24" r="8"/><path d="M17 7c9-4 18 3 18 11M13 30c0 9 9 15 17 11"/>',
  cut: '<path d="m9 40 7-12 3 3 9-14-1-4L40 7 26 26l-3-3Z"/><path class="icon-detail" d="m7 16 8 2M31 34l9 1"/>',
  orbital: '<ellipse cx="24" cy="27" rx="16" ry="8"/><path d="m32 5-7 14m15-7-7 13M15 7 9 19"/><circle class="icon-core" cx="23" cy="27" r="4"/><path d="M18 38h12"/>',
  seed: '<path d="M24 39V23m0 7-11-9m11 2 10-10M24 31l12-3"/><circle cx="10" cy="18" r="5"/><circle cx="37" cy="10" r="5"/><circle cx="39" cy="27" r="4"/><circle class="icon-core" cx="24" cy="20" r="6"/>',
};
export function skillSymbol(id) {
  return `<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${shapes[id] || '<circle cx="24" cy="24" r="7"/><path d="M24 20v8M20 24h8"/>'}</svg>`;
}
