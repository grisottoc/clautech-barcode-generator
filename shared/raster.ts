export interface RasterInput {
  width: number;
  height: number;
  data: Uint8Array; // RGBA, length = width * height * 4
}

function isBlackPixel(data: Uint8Array, idx: number): boolean {
  return (
    data[idx + 0] === 0 &&
    data[idx + 1] === 0 &&
    data[idx + 2] === 0 &&
    data[idx + 3] === 255
  );
}

export function trimBlackAndPad(input: RasterInput, padPx: number): RasterInput {
  if (!Number.isInteger(padPx) || padPx < 0) {
    throw new Error(`trimBlackAndPad: padPx must be an integer >= 0. Got: ${padPx}`);
  }

  const expectedLen = input.width * input.height * 4;
  if (input.data.length !== expectedLen) {
    throw new Error(
      `trimBlackAndPad: invalid RGBA length: got ${input.data.length}, expected ${expectedLen}`
    );
  }

  let minX = input.width;
  let minY = input.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < input.height; y++) {
    for (let x = 0; x < input.width; x++) {
      const i = (y * input.width + x) * 4;
      if (!isBlackPixel(input.data, i)) continue;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  // No black pixels: keep original raster.
  if (maxX < minX || maxY < minY) {
    return input;
  }

  const croppedW = maxX - minX + 1;
  const croppedH = maxY - minY + 1;

  const outW = croppedW + padPx * 2;
  const outH = croppedH + padPx * 2;
  const out = new Uint8Array(outW * outH * 4);
  out.fill(255);

  for (let y = 0; y < croppedH; y++) {
    const srcRow = ((minY + y) * input.width + minX) * 4;
    const dstRow = ((padPx + y) * outW + padPx) * 4;
    out.set(input.data.subarray(srcRow, srcRow + croppedW * 4), dstRow);
  }

  return { width: outW, height: outH, data: out };
}
