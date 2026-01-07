# 📋 Changelog

Wszystkie istotne zmiany w projekcie Petrie Dish będą dokumentowane w tym pliku.

Format bazuje na [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [v5.0-C1] - 2025-01-07 ✅ CURRENT STABLE

### ✨ Added
- **WebGPU Integration**
  - GPU detection & initialization
  - Fallback na CPU dla starszych przeglądarek
  - WebGPU canvas context z zero-copy rendering
  
- **GPU Buffer Manager**
  - Position buffer (Float32Array × 2)
  - Velocity buffer (Float32Array × 2)
  - Color index buffer (Uint32Array)
  - Mass buffer (Float32Array)
  - Active flag buffer (Uint32Array)
  - Upload/download CPU ↔ GPU
  
- **Performance Optimizations**
  - Text measurement cache (OPT-4): 2-5× faster UI rendering
  - LRU cache (max 1000 entries)
  - Matrix rendering optimization (OPT-5)
  - ~90% cache hit rate on UI text

- **UI System**
  - BaseWindow class (draggable, closable)
  - Taskbar (Windows-style)
  - Stats monitoring window
  - Matrix editor (16×16 grid)
  - Event router (centralized event handling)

### 🔧 Changed
- Przejście na dwukanałowy rendering (WebGL + Canvas 2D)
- Optymalizacja measureText() przez cache
- Improved error logging

### 🐛 Fixed
- Canvas context initialization dla WebGPU
- Memory leaks w particle system
- Text measurement performance bottleneck
- WebGL shader compilation errors

### ⚠️ Known Issues
- Legacy CPU physics code nadal obecny (planowane usunięcie w v5.1-C2)
- WebGL fallback nie w pełni przetestowany
- Niektóre funkcje GPU compute nieużywane

### 📊 Performance
- UI rendering: 2-5× szybsze (text cache)
- Target: 60 FPS @ 10,000 particles
- GPU memory: ~3.8 MB dla 100k particles

---

## [v5.1-C2-dev] - WIP 🔄

### 🎯 Goals
- Pełna migracja na GPU compute
- Usunięcie legacy CPU physics code
- Pipeline optimization

### 📝 TODO
- [ ] Audit całego CPU physics code
- [ ] Migracja do compute shaders
- [ ] Usunięcie updateParticles() CPU
- [ ] Benchmarking
- [ ] Testing

---

## [Unreleased]

### 💡 Ideas
- Export/Import konfiguracji matrycy
- Replay system (record/playback)
- Extended color palette (32 colors?)
- Preset library
- Screenshot/video export

---

## Version History

| Version | Date | Status | Notes |
|---------|------|--------|-------|
| v5.0-C1 | 2025-01-07 | ✅ Stable | WebGPU Zero-Copy |
| v5.1-C2 | TBD | 🔄 Dev | Full GPU Migration |
| v5.2-C3 | TBD | 📋 Planned | Advanced Features |

---

**Legend:**
- ✨ Added - nowe features
- 🔧 Changed - zmiany w istniejących features
- 🐛 Fixed - bugfixy
- ⚠️ Known Issues - znane problemy
- 📊 Performance - metryki wydajności
- 🗑️ Deprecated - przestarzałe features
- 🔥 Removed - usunięte features
