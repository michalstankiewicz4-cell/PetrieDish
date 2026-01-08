# Module Structure Map

> Decomposition of petrie-dish-v5.1-C2.html into modular architecture

## 📦 Module Organization

### `/src/core/` - Core Systems
**Files:**
- `constants.js` - All magic numbers, limits, configurations
- `settings.js` - Runtime settings, user preferences
- `init.js` - Application initialization, WebGPU detection
- `error-handler.js` - Error console capture system
- `workgroup-config.js` - Dynamic workgroup size configuration (NEW in v5.1-C2)

**Lines:** ~350  
**Dependencies:** None (foundation layer)

---

### `/src/gpu/` - WebGPU Engine
**Files:**
- `webgpu-init.js` - WebGPU adapter, device initialization
- `buffer-manager.js` - GPU buffer management class
- `compute-physics.js` - Physics compute shaders (WGSL)
- `compute-pipeline.js` - Compute pipeline setup
- `gpu-renderer.js` - WebGPU rendering pipeline (zero-copy)

**Lines:** ~800  
**Dependencies:** `core/`

---

### `/src/physics/` - Physics Engine (GPU-Only)
**Files:**
- `particle.js` - Particle class, data structures
- `interactions.js` - Particle interaction calculations (GPU)
- `color-matrix.js` - 16-color interaction matrix logic

**Lines:** ~450 (reduced from ~600, CPU code removed in v5.1-C2)  
**Dependencies:** `core/`, `gpu/`

**Removed in v5.1-C2:**
- ~~`spatial-hash.js`~~ - CPU spatial hash (replaced by GPU)
- ~~`collision.js`~~ - CPU collision detection (moved to GPU)
- ~~CPU physics methods~~ - All physics now GPU-only (-152 lines)

---

### `/src/rendering/` - Rendering Systems
**Files:**
- `webgl-shaders.js` - WebGL shader programs (fallback)
- `webgl-renderer.js` - WebGL point sprite rendering
- `camera.js` - Camera zoom, pan, viewport management
- `canvas-utils.js` - Canvas helper functions

**Lines:** ~400  
**Dependencies:** `core/`, `physics/`

---

### `/src/ui/` - User Interface
**Files:**
- `ui-foundation.js` - Base UI classes (UIElement, UIContainer)
- `ui-items.js` - UI components (Button, Slider, Checkbox, etc.)
- `ui-renderer.js` - Shared UI drawing code
- `base-window.js` - BaseWindow class with drag/resize
- `stats-window.js` - FPS and statistics window
- `matrix-window.js` - Interaction matrix editor
- `settings-window.js` - Settings panel
- `taskbar.js` - Windows-style taskbar
- `window-manager.js` - Window management system
- `event-router.js` - Centralized event handling

**Lines:** ~1500  
**Dependencies:** `core/`, `physics/`

---

### `/src/utils/` - Utilities
**Files:**
- `text-cache.js` - Text measurement caching (OPT-4)
- `math-utils.js` - Common math functions
- `color-utils.js` - Color conversion, manipulation
- `debug-utils.js` - Performance profiling, logging

**Lines:** ~200  
**Dependencies:** None

---

## 🔗 Dependency Graph

```
┌─────────┐
│  core/  │
└────┬────┘
     │
     ├──────────┬──────────┬──────────┐
     │          │          │          │
┌────▼────┐ ┌──▼───┐  ┌───▼────┐ ┌──▼────┐
│  gpu/   │ │phys/ │  │render/ │ │utils/ │
└────┬────┘ └──┬───┘  └───┬────┘ └───────┘
     │         │           │
     └────┬────┴─────┬─────┘
          │          │
       ┌──▼──────────▼──┐
       │      ui/       │
       └────────────────┘
```

---

## 📄 Main Entry Points

### `/index.html` - Development Version
```html
<!DOCTYPE html>
<html>
<head>
    <title>Petrie Dish v5.1-C2-dev</title>
    <style>/* Inline CSS */</style>
</head>
<body>
    <canvas id="glCanvas"></canvas>
    <canvas id="uiCanvas"></canvas>
    
    <!-- Module loading -->
    <script type="module" src="src/main.js"></script>
</body>
</html>
```

### `/src/main.js` - Application Entry
```javascript
import { initializeApp } from './core/init.js';
import { GPUBufferManager } from './gpu/buffer-manager.js';
import { WindowManager } from './ui/window-manager.js';
// ... other imports

async function main() {
    await initializeApp();
    // Start simulation
}

main();
```

### `/dist/petrie-dish-v5.x.html` - Production Build
Single-file concatenated build with all modules inlined.

---

## 🛠️ Build Process

### Development
```bash
# Run locally with module support
python -m http.server 8000
# Open http://localhost:8000
```

### Production Build
```bash
# Concatenate all modules into single HTML file
node build/concat-modules.js
# Output: dist/petrie-dish-v5.1-C2.html
```

---

## 📊 Line Count Breakdown

**v5.1-C2** (Current)

| Module | Lines | % Total | Status |
|--------|-------|---------|--------|
| `core/` | ~350 | 8% | ✅ Optimized |
| `gpu/` | ~900 | 21% | ✅ Enhanced (workgroup benchmark) |
| `physics/` | ~450 | 11% | ✅ GPU-only (CPU removed) |
| `rendering/` | ~400 | 9% | ✅ Extracted |
| `ui/` | ~1500 | 35% | ✅ Extracted |
| `utils/` | ~200 | 5% | ✅ Extracted |
| CSS | ~40 | 1% | In index.html |
| HTML | ~15 | <1% | In index.html |
| Main Loop | ~300 | 7% | In main.js |
| ~~Legacy Code~~ | ~~0~~ | ~~0%~~ | ✅ **Removed in v5.1-C2** |
| **Total** | **~4250** | **100%** | **-152 lines vs v5.0-C1** |

**Changes from v5.0-C1:**
- ✅ Removed CPU physics code: -152 lines
- ✅ Added workgroup benchmark: +120 lines
- ✅ Buffer sync optimization: +30 lines
- ✅ Net change: -2 lines (cleaner, faster)

---

## 🎯 Migration Status

- [x] Structure designed
- [ ] Core modules extracted
- [ ] GPU modules extracted
- [ ] Physics modules extracted
- [ ] Rendering modules extracted
- [ ] UI modules extracted
- [ ] Utils modules extracted
- [ ] index.html created
- [ ] main.js created
- [ ] Build script created
- [ ] Testing completed

**Target Completion:** v5.2 (Advanced GPU Optimizations) - 2025-02-28

---

**Last Updated:** 2025-01-08
