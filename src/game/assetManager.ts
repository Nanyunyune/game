import { ASSET_SLOTS, BUILTIN_ASSET_URLS, clamp } from './constants';
import type { AssetSlotDef, LoadedAsset, SheetGrid, SpriteFrame } from './types';

type ChangeListener = () => void;
type ToastFn = (msg: string, duration?: number) => void;

class AssetManagerStore {
  public autoKey = true;
  public tolerance = 36;
  public grid: SheetGrid = '2x5';

  private rawImages: Record<string, HTMLImageElement> = {};
  private builtinKeys = new Set<string>();
  private assets: Record<string, LoadedAsset> = {};
  private listeners = new Set<ChangeListener>();
  private toastFn: ToastFn | null = null;
  private version = 0;
  private builtinLoaded = false;

  public setToastHandler(fn: ToastFn | null): void {
    this.toastFn = fn;
  }

  public subscribe(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getVersion(): number {
    return this.version;
  }

  private notify(): void {
    this.version += 1;
    this.listeners.forEach((fn) => fn());
  }

  public get(key: string): LoadedAsset | null {
    return this.assets[key] ?? null;
  }

  public getAll(): Record<string, LoadedAsset> {
    return this.assets;
  }

  /**
   * Automatically loads all built-in dark-fairy-tale art assets & 3 sword slash VFX sheets
   */
  public loadBuiltinAssets(force = false): void {
    if (this.builtinLoaded && !force) return;
    this.builtinLoaded = true;

    let notifyTimer: number | null = null;
    const scheduleNotify = () => {
      if (notifyTimer !== null) return;
      notifyTimer = window.setTimeout(() => {
        notifyTimer = null;
        this.notify();
      }, 60);
    };

    Object.entries(BUILTIN_ASSET_URLS).forEach(([slotKey, url]) => {
      const slot = ASSET_SLOTS.find((s) => s.key === slotKey);
      if (!slot) return;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.rawImages[slotKey] = img;
        this.builtinKeys.add(slotKey);
        this.processSlot(slot, img, true);
        scheduleNotify();
      };
      img.src = url;
    });
  }

  /**
   * Luminance-based alpha keying specifically for black-background VFX sprite sheets.
   * Preserves glowing cyan/gold smoke & sparks cleanly without dark fringes.
   */
  private keyOutBlackVfx(srcCanvas: HTMLCanvasElement, maskBottomRightWatermark: boolean): HTMLCanvasElement {
    const w = srcCanvas.width;
    const h = srcCanvas.height;
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const octx = out.getContext('2d');
    if (!octx) return srcCanvas;
    octx.drawImage(srcCanvas, 0, 0);

    const imgData = octx.getImageData(0, 0, w, h);
    const d = imgData.data;

    // Cleanly remove the small corner diamond watermark in bottom-right cell of 2x3 VFX sheets
    const wmMinX = Math.floor(w * 0.78);
    const wmMinY = Math.floor(h * 0.72);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (maskBottomRightWatermark && x >= wmMinX && y >= wmMinY) {
          // Only mask low-saturation grey watermark pixels, preserving warm/cyan ember glow
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          const maxC = Math.max(r, g, b);
          const minC = Math.min(r, g, b);
          const sat = maxC > 0 ? (maxC - minC) / maxC : 0;
          if (sat < 0.16 && maxC < 210) {
            d[i] = 0;
            d[i + 1] = 0;
            d[i + 2] = 0;
            d[i + 3] = 0;
            continue;
          }
        }

        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const maxC = Math.max(r, g, b);

        if (maxC <= 12) {
          d[i + 3] = 0;
        } else {
          const norm = clamp((maxC - 10) / 245, 0, 1);
          const alpha = Math.pow(norm, 0.88);
          d[i] = Math.min(255, Math.round(r / Math.max(0.18, alpha)));
          d[i + 1] = Math.min(255, Math.round(g / Math.max(0.18, alpha)));
          d[i + 2] = Math.min(255, Math.round(b / Math.max(0.18, alpha)));
          d[i + 3] = Math.round(alpha * 255);
        }
      }
    }

    octx.putImageData(imgData, 0, 0);
    return out;
  }

  private cleanCornerWatermark(srcCanvas: HTMLCanvasElement): HTMLCanvasElement {
    const w = srcCanvas.width;
    const h = srcCanvas.height;
    const octx = srcCanvas.getContext('2d');
    if (!octx) return srcCanvas;
    const imgData = octx.getImageData(0, 0, w, h);
    const d = imgData.data;
    const minX = Math.floor(w * 0.84);
    const minY = Math.floor(h * 0.78);
    for (let y = minY; y < h; y++) {
      for (let x = minX; x < w; x++) {
        const i = (y * w + x) * 4;
        if (d[i + 3] < 10) continue;
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const sat = maxC > 0 ? (maxC - minC) / maxC : 0;
        // Gently darken faint grey star watermark blended onto dark stone edge
        if (sat < 0.14 && maxC > 95 && maxC < 215) {
          d[i] = Math.round(r * 0.35);
          d[i + 1] = Math.round(g * 0.42);
          d[i + 2] = Math.round(b * 0.45);
        }
      }
    }
    octx.putImageData(imgData, 0, 0);
    return srcCanvas;
  }

  private keyOutBackground(
    srcCanvas: HTMLCanvasElement,
    options?: { removeInteriorWhite?: boolean }
  ): HTMLCanvasElement {
    const w = srcCanvas.width;
    const h = srcCanvas.height;
    if (!this.autoKey || w === 0 || h === 0) return srcCanvas;

    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const octx = out.getContext('2d');
    if (!octx) return srcCanvas;
    octx.drawImage(srcCanvas, 0, 0);
    const imgData = octx.getImageData(0, 0, w, h);
    const d = imgData.data;

    let transparentCorners = 0;
    const cornerIdx = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + (w - 1)) * 4];
    for (const ci of cornerIdx) {
      if (d[ci + 3] < 20) transparentCorners++;
    }
    if (transparentCorners >= 2) return out;

    let bgR = 0;
    let bgG = 0;
    let bgB = 0;
    for (const ci of cornerIdx) {
      bgR += d[ci];
      bgG += d[ci + 1];
      bgB += d[ci + 2];
    }
    bgR /= 4;
    bgG /= 4;
    bgB /= 4;

    const tolSq = this.tolerance * this.tolerance * 3;
    const visited = new Uint8Array(w * h);
    const queue = new Int32Array(w * h);
    let head = 0;
    let tail = 0;

    const tryPush = (x: number, y: number) => {
      const p = y * w + x;
      if (visited[p]) return;
      const i = p * 4;
      if (d[i + 3] < 10) {
        visited[p] = 1;
        queue[tail++] = p;
        return;
      }
      const dr = d[i] - bgR;
      const dg = d[i + 1] - bgG;
      const db = d[i + 2] - bgB;
      if (dr * dr + dg * dg + db * db <= tolSq) {
        visited[p] = 1;
        queue[tail++] = p;
      }
    };

    for (let x = 0; x < w; x++) {
      tryPush(x, 0);
      tryPush(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      tryPush(0, y);
      tryPush(w - 1, y);
    }

    while (head < tail) {
      const p = queue[head++];
      d[p * 4 + 3] = 0;
      const x = p % w;
      const y = (p - x) / w;
      if (x > 0) tryPush(x - 1, y);
      if (x < w - 1) tryPush(x + 1, y);
      if (y > 0) tryPush(x, y - 1);
      if (y < h - 1) tryPush(x, y + 1);
    }

    // For ornate ironwork, chain links & vine loops on pure white backgrounds, also key enclosed pure-white holes
    const isWhiteBg = bgR > 235 && bgG > 235 && bgB > 235;
    if (isWhiteBg && options?.removeInteriorWhite) {
      for (let p = 0; p < w * h; p++) {
        if (visited[p]) continue;
        const i = p * 4;
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        if (minC >= 228 && maxC - minC <= 20) {
          d[i + 3] = 0;
          visited[p] = 1;
        }
      }
    }

    const softSq = tolSq * 2.1;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        if (visited[p]) continue;
        if (visited[p - 1] || visited[p + 1] || visited[p - w] || visited[p + w]) {
          const i = p * 4;
          const dr = d[i] - bgR;
          const dg = d[i + 1] - bgG;
          const db = d[i + 2] - bgB;
          if (dr * dr + dg * dg + db * db <= softSq) {
            d[i + 3] = Math.round(d[i + 3] * 0.32);
          }
        }
      }
    }

    octx.putImageData(imgData, 0, 0);
    return out;
  }

  private trimCanvasWithBounds(
    srcCanvas: HTMLCanvasElement
  ): { canvas: HTMLCanvasElement; minX: number; minY: number; maxX: number; maxY: number } | null {
    const w = srcCanvas.width;
    const h = srcCanvas.height;
    const sctx = srcCanvas.getContext('2d');
    if (!sctx) return null;
    const d = sctx.getImageData(0, 0, w, h).data;
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 24) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) return null;
    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;
    const out = document.createElement('canvas');
    out.width = cw;
    out.height = ch;
    out.getContext('2d')?.drawImage(srcCanvas, minX, minY, cw, ch, 0, 0, cw, ch);
    return { canvas: out, minX, minY, maxX, maxY };
  }

  private trimCanvas(srcCanvas: HTMLCanvasElement): HTMLCanvasElement | null {
    return this.trimCanvasWithBounds(srcCanvas)?.canvas ?? null;
  }

  /**
   * Computes a rock-solid horizontal torso/head anchor X inside a trimmed sprite frame.
   * Uses cubic vertical-column mass weighting while ignoring bright cyan slash VFX pixels
   * so fluttering scarves, capes, and sword arcs never jerk the character left/right.
   */
  private computeTorsoAnchorX(trimmed: HTMLCanvasElement): number {
    const w = trimmed.width;
    const h = trimmed.height;
    const ctx = trimmed.getContext('2d');
    if (!ctx || w <= 2 || h <= 2) return w * 0.5;
    const d = ctx.getImageData(0, 0, w, h).data;

    const yStart = Math.floor(h * 0.08);
    const yEnd = Math.ceil(h * 0.88);
    let weightedSum = 0;
    let weightTotal = 0;

    for (let x = 0; x < w; x++) {
      let colCount = 0;
      for (let y = yStart; y < yEnd; y++) {
        const i = (y * w + x) * 4;
        if (d[i + 3] <= 40) continue;
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        // Ignore bright cyan slash trail / wind-streak pixels so weapon arcs don't shift body anchor
        if (b > 175 && g > 175 && r < 165) continue;
        colCount++;
      }
      if (colCount > 0) {
        const weight = colCount * colCount * colCount;
        weightedSum += x * weight;
        weightTotal += weight;
      }
    }

    return weightTotal > 0 ? weightedSum / weightTotal : w * 0.5;
  }

  private createTintedCanvas(srcCanvas: HTMLCanvasElement, color: string): HTMLCanvasElement {
    const out = document.createElement('canvas');
    out.width = srcCanvas.width;
    out.height = srcCanvas.height;
    const octx = out.getContext('2d');
    if (!octx) return out;
    octx.drawImage(srcCanvas, 0, 0);
    octx.globalCompositeOperation = 'source-in';
    octx.fillStyle = color;
    octx.fillRect(0, 0, out.width, out.height);
    return out;
  }

  private buildFrame(trimmed: HTMLCanvasElement, footLift = 0): SpriteFrame {
    return {
      canvas: trimmed,
      white: this.createTintedCanvas(trimmed, '#ffffff'),
      cyan: this.createTintedCanvas(trimmed, '#67e8f9'),
      gold: this.createTintedCanvas(trimmed, '#fde047'),
      w: trimmed.width,
      h: trimmed.height,
      anchorX: this.computeTorsoAnchorX(trimmed),
      footLift,
    };
  }

  private processSlot(slot: AssetSlotDef, img: HTMLImageElement, isBuiltin = false): void {
    const base = document.createElement('canvas');
    base.width = img.naturalWidth || img.width;
    base.height = img.naturalHeight || img.height;
    base.getContext('2d')?.drawImage(img, 0, 0);

    if (slot.kind === 'bg') {
      this.assets[slot.key] = {
        canvas: base,
        w: base.width,
        h: base.height,
        previewUrl: base.toDataURL('image/png'),
      };
      return;
    }

    if (slot.kind === 'vfx_2x3') {
      const rows = 2;
      const cols = 3;
      const cellW = Math.floor(base.width / cols);
      const cellH = Math.floor(base.height / rows);
      const frames: SpriteFrame[] = [];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const sub = document.createElement('canvas');
          sub.width = cellW;
          sub.height = cellH;
          sub
            .getContext('2d')
            ?.drawImage(base, c * cellW, r * cellH, cellW, cellH, 0, 0, cellW, cellH);
          // Keep consistent cell anchor so the 6-frame crescent slash rotates smoothly in place
          const keyed = this.keyOutBlackVfx(sub, r === 1 && c === 2);
          frames.push({
            canvas: keyed,
            white: keyed,
            cyan: keyed,
            gold: keyed,
            w: keyed.width,
            h: keyed.height,
          });
        }
      }

      this.assets[slot.key] = {
        frames,
        previewUrl: frames[2]?.canvas.toDataURL('image/png') || frames[0].canvas.toDataURL('image/png'),
        status: `已切出 ${frames.length} 帧刀光`,
      };
      return;
    }

    if (slot.kind === 'batch_tiles') {
      const cleaned = this.keyOutBackground(base);
      const targetKeys = [
        'tile_ground',
        'tile_suspend',
        'tile_solid',
        'tile_oneway',
        'tile_fragile',
        'tile_shrine',
      ];
      const cellW = Math.floor(cleaned.width / 3);
      const cellH = Math.floor(cleaned.height / 2);
      let filled = 0;
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          const sub = document.createElement('canvas');
          sub.width = cellW;
          sub.height = cellH;
          sub
            .getContext('2d')
            ?.drawImage(cleaned, c * cellW, r * cellH, cellW, cellH, 0, 0, cellW, cellH);
          const trimmed = this.trimCanvas(sub) || sub;
          const tKey = targetKeys[r * 3 + c];
          this.assets[tKey] = {
            canvas: trimmed,
            white: this.createTintedCanvas(trimmed, '#ffffff'),
            cyan: this.createTintedCanvas(trimmed, '#67e8f9'),
            gold: this.createTintedCanvas(trimmed, '#fde047'),
            w: trimmed.width,
            h: trimmed.height,
            previewUrl: trimmed.toDataURL('image/png'),
          };
          filled++;
        }
      }
      this.assets[slot.key] = {
        canvas: cleaned,
        w: cleaned.width,
        h: cleaned.height,
        previewUrl: cleaned.toDataURL('image/png'),
        status: `已切分填入 ${filled} 类台阶`,
      };
      return;
    }

    if (slot.kind === 'single') {
      const cleaned = this.keyOutBackground(base, {
        removeInteriorWhite: slot.removeInteriorWhite,
      });
      const trimmed = this.trimCanvas(cleaned) || cleaned;
      const finalCanvas = slot.maskCornerWatermark ? this.cleanCornerWatermark(trimmed) : trimmed;
      this.assets[slot.key] = {
        canvas: finalCanvas,
        white: this.createTintedCanvas(finalCanvas, '#ffffff'),
        cyan: this.createTintedCanvas(finalCanvas, '#67e8f9'),
        gold: this.createTintedCanvas(finalCanvas, '#fde047'),
        w: finalCanvas.width,
        h: finalCanvas.height,
        previewUrl: finalCanvas.toDataURL('image/png'),
      };
      return;
    }

    const [rows, cols] = this.grid.split('x').map(Number);
    const cleaned = this.keyOutBackground(base);
    const cellW = Math.floor(cleaned.width / cols);
    const cellH = Math.floor(cleaned.height / rows);

    interface RawCellTrim {
      row: number;
      canvas: HTMLCanvasElement;
      maxY: number;
    }
    const rawTrims: RawCellTrim[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const sub = document.createElement('canvas');
        sub.width = cellW;
        sub.height = cellH;
        sub
          .getContext('2d')
          ?.drawImage(cleaned, c * cellW, r * cellH, cellW, cellH, 0, 0, cellW, cellH);
        const res = this.trimCanvasWithBounds(sub);
        if (res && res.canvas.width > 4 && res.canvas.height > 4) {
          rawTrims.push({ row: r, canvas: res.canvas, maxY: res.maxY });
        }
      }
    }

    // Per-row consistent foot baseline so lifted feet don't violently snap the head downward
    const rowBaselines = new Map<number, number>();
    for (let r = 0; r < rows; r++) {
      const ys = rawTrims.filter((t) => t.row === r).map((t) => t.maxY);
      if (ys.length > 0) {
        rowBaselines.set(r, Math.max(...ys));
      }
    }

    const frames: SpriteFrame[] = rawTrims.map((item) => {
      const baseMaxY = rowBaselines.get(item.row) ?? item.maxY;
      const lift = clamp(baseMaxY - item.maxY, 0, cellH * 0.06);
      return this.buildFrame(item.canvas, lift);
    });

    if (frames.length === 0) {
      const trimmed = this.trimCanvas(cleaned) || cleaned;
      frames.push(this.buildFrame(trimmed, 0));
    }

    // Median trimmed height gives a rock-solid uniform pixel scale across every frame
    const sortedH = [...frames].map((f) => f.h).sort((a, b) => a - b);
    const refH = sortedH[Math.floor(sortedH.length / 2)] || frames[0]?.h || 1;

    this.assets[slot.key] = {
      frames,
      refH,
      isBuiltin,
      previewUrl: (slot.key === 'player_idle' && frames[1] ? frames[1] : frames[0]).canvas.toDataURL('image/png'),
      status: `已切出 ${frames.length} 帧`,
    };
  }

  public loadFile(slotKey: string, file: File): void {
    if (!file || !file.type.startsWith('image/')) {
      this.toastFn?.('请上传 PNG / JPG 格式的图片素材');
      return;
    }
    const slot = ASSET_SLOTS.find((s) => s.key === slotKey);
    if (!slot) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        this.rawImages[slotKey] = img;
        this.builtinKeys.delete(slotKey);
        this.processSlot(slot, img, false);
        this.notify();
        this.toastFn?.(`已导入：${slot.name}`);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  public setAutoKey(enabled: boolean): void {
    this.autoKey = enabled;
    this.rebuildAll();
  }

  public setTolerance(tol: number, rebuild = true): void {
    this.tolerance = tol;
    if (rebuild) this.rebuildAll();
    else this.notify();
  }

  public setGrid(grid: SheetGrid): void {
    this.grid = grid;
    this.rebuildAll();
  }

  public rebuildAll(): void {
    for (const slot of ASSET_SLOTS) {
      if (this.rawImages[slot.key]) {
        this.processSlot(slot, this.rawImages[slot.key], this.builtinKeys.has(slot.key));
      }
    }
    this.notify();
  }

  public clearSlot(slotKey: string): void {
    delete this.rawImages[slotKey];
    this.builtinKeys.delete(slotKey);
    delete this.assets[slotKey];
    this.notify();
  }

  public clearAll(): void {
    this.rawImages = {};
    this.builtinKeys.clear();
    this.assets = {};
    this.loadBuiltinAssets(true);
    this.notify();
    this.toastFn?.('已重新载入全套内置暗黑童话手绘素材包');
  }
}

export const AssetManager = new AssetManagerStore();
