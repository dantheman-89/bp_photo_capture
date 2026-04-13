const PATCH_SIZE = 256
const HITS_NEEDED = 4
const MEAN_ABS_THRESHOLD = 0.025
const DENSITY_THRESHOLD = 0.45
const PERIODICITY_THRESHOLD = 0.18
const DENSITY_EDGE_THRESHOLD = 0.02

export function detectMonitorPhoto(canvas) {
  const width = canvas.width
  const height = canvas.height

  if (!width || !height) {
    return { isMonitorPhoto: false, hits: 0, patchCount: 0, patches: [] }
  }

  const size = Math.min(PATCH_SIZE, width, height)
  if (size < 128) {
    return { isMonitorPhoto: false, hits: 0, patchCount: 0, patches: [] }
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const positions = buildPatchPositions(width, height, size)
  const patches = positions.map(({ left, top }) => analyzePatch(ctx.getImageData(left, top, size, size), size))
  const hits = patches.filter(isStrongMonitorPatch).length

  return {
    isMonitorPhoto: hits >= HITS_NEEDED,
    hits,
    patchCount: patches.length,
    patches,
    message: 'This photo looks like it was taken from a monitor or phone screen. Please photograph the blood pressure monitor directly.',
  }
}

function buildPatchPositions(width, height, size) {
  const positions = [
    [width / 4, height / 4],
    [width / 2, height / 4],
    [(3 * width) / 4, height / 4],
    [width / 4, height / 2],
    [width / 2, height / 2],
    [(3 * width) / 4, height / 2],
    [width / 4, (3 * height) / 4],
    [width / 2, (3 * height) / 4],
    [(3 * width) / 4, (3 * height) / 4],
  ]

  return positions.map(([cx, cy]) => ({
    left: clamp(Math.round(cx - size / 2), 0, width - size),
    top: clamp(Math.round(cy - size / 2), 0, height - size),
  }))
}

function analyzePatch(imageData, size) {
  const pixelCount = size * size
  const y = new Float32Array(pixelCount)
  const rg = new Float32Array(pixelCount)
  const bg = new Float32Array(pixelCount)
  const data = imageData.data

  for (let src = 0, dst = 0; dst < pixelCount; src += 4, dst += 1) {
    const r = data[src] / 255
    const g = data[src + 1] / 255
    const b = data[src + 2] / 255

    y[dst] = (0.299 * r) + (0.587 * g) + (0.114 * b)
    rg[dst] = r - g
    bg[dst] = b - g
  }

  const yBlur = blur3x3(y, size)
  const rgBlur = blur3x3(rg, size)
  const bgBlur = blur3x3(bg, size)
  const chromaHigh = new Float32Array(pixelCount)

  let meanAbs = 0
  let denseCount = 0

  for (let i = 0; i < pixelCount; i += 1) {
    const yResidual = y[i] - yBlur[i]
    const chromaResidual = (rg[i] - rgBlur[i]) + (bg[i] - bgBlur[i])

    chromaHigh[i] = chromaResidual

    const absResidual = Math.abs(yResidual)
    meanAbs += absResidual
    if (absResidual > DENSITY_EDGE_THRESHOLD) denseCount += 1
  }

  return {
    meanAbs: meanAbs / pixelCount,
    density: denseCount / pixelCount,
    periodicity: maxLagCorrelation(chromaHigh, size, 2, 4),
  }
}

function isStrongMonitorPatch(patch) {
  return (
    patch.meanAbs > MEAN_ABS_THRESHOLD &&
    patch.density > DENSITY_THRESHOLD &&
    patch.periodicity > PERIODICITY_THRESHOLD
  )
}

function blur3x3(source, size) {
  const out = new Float32Array(source.length)

  for (let y = 0; y < size; y += 1) {
    const y0 = Math.max(0, y - 1)
    const y1 = y
    const y2 = Math.min(size - 1, y + 1)

    for (let x = 0; x < size; x += 1) {
      const x0 = Math.max(0, x - 1)
      const x1 = x
      const x2 = Math.min(size - 1, x + 1)
      const index = (y * size) + x

      out[index] = (
        source[(y0 * size) + x0] + source[(y0 * size) + x1] + source[(y0 * size) + x2] +
        source[(y1 * size) + x0] + source[(y1 * size) + x1] + source[(y1 * size) + x2] +
        source[(y2 * size) + x0] + source[(y2 * size) + x1] + source[(y2 * size) + x2]
      ) / 9
    }
  }

  return out
}

function maxLagCorrelation(source, size, minLag, maxLag) {
  let best = 0

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    best = Math.max(best, lagCorrelation(source, size, lag, 0))
    best = Math.max(best, lagCorrelation(source, size, 0, lag))
  }

  return best
}

function lagCorrelation(source, size, dx, dy) {
  const limitX = size - dx
  const limitY = size - dy
  const count = limitX * limitY

  if (count <= 1) return 0

  let sumA = 0
  let sumB = 0
  let sumAA = 0
  let sumBB = 0
  let sumAB = 0

  for (let y = 0; y < limitY; y += 1) {
    const rowA = y * size
    const rowB = (y + dy) * size

    for (let x = 0; x < limitX; x += 1) {
      const a = source[rowA + x]
      const b = source[rowB + x + dx]

      sumA += a
      sumB += b
      sumAA += a * a
      sumBB += b * b
      sumAB += a * b
    }
  }

  const meanA = sumA / count
  const meanB = sumB / count
  const varA = sumAA - (count * meanA * meanA)
  const varB = sumBB - (count * meanB * meanB)

  if (varA <= 1e-8 || varB <= 1e-8) return 0

  const cov = sumAB - (count * meanA * meanB)
  return cov / Math.sqrt(varA * varB)
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}
