/** Local visual-wall experiment. No shape is read from or written to the API. */
export const prototypeFormats = ["9:16", "3:4", "1:1", "4:3", "circle"] as const;
export type PrototypeFormat = (typeof prototypeFormats)[number];

// Stable for a given Space ordering; removable when presentation metadata exists.
export function prototypeFormatForIndex(index: number): PrototypeFormat {
  return prototypeFormats[index % prototypeFormats.length];
}

export function prototypeAspectRatio(format: PrototypeFormat): number {
  switch (format) {
    case "9:16": return 9 / 16;
    case "3:4": return 3 / 4;
    case "4:3": return 4 / 3;
    case "1:1":
    case "circle": return 1;
  }
}
