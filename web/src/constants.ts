export const colors = {
  blue: "#88aaff",
  red: "#ff0000",
  sliderBackground: "#e5e5e5",

  barcodeBackground: "#e5e5e5",

  surfaceSelected: "#d7f0ff",

  dim0: "orange", // FFA500
  dim1: "pink", // FFC0CB
  dim_1: "gray",
  dim2: "#8cadf1",
};

export const dim2color: Record<string, string> = {
  "-1": colors.dim_1,
  "0": colors.dim0,
  "1": colors.dim1,
  "2": colors.dim2,
};

export const dim2rgb: Record<string, [number, number, number]> = {
  "-1": [0.3137, 0.3137, 0.3137],
  "0": [0xff / 255, 0xa5 / 255, 0x00 / 255],
  "1": [0xff / 255, 0xc0 / 255, 0xcb / 255],
  "2": [0x8c / 255, 0xad / 255, 0xf1 / 255],
};
