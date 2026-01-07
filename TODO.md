# TODO List

## 🔥 Priority 1 - v5.1-C2 (Full GPU Migration)
**Target:** 2025-01-20  
**Status:** Not started

### Code Cleanup
- [x] **Remove legacy CPU physics code** (~150 lines) ✅ DONE 2025-01-07
  - [x] Delete Particle.update() CPU method
  - [x] Remove CPU collision detection (applyParticleInteractions, applyForcesBetween)
  - [x] Remove SpatialHash class (CPU optimization)
  - [x] Remove CPU fallback path in animate()
  - [x] Add WebGPU Required error screen
  - Impact: Cleaner codebase (-152 lines), easier maintenance
  - Result: GPU-only physics, clear error messaging

### GPU Optimization
- [ ] **Optimize GPU compute shader dispatch**
  - [ ] Benchmark different workgroup sizes (current: 256)
  - [ ] Test different buffer layouts
  - [ ] Profile GPU memory bandwidth
  - [ ] Document optimal configurations
  - Goal: Maximum performance for 100k particles

- [ ] **Improve buffer synchronization**
  - [ ] Minimize CPU-GPU data transfers
  - [ ] Batch buffer updates where possible
  - [ ] Implement dirty flag system
  - [ ] Optimize data flow patterns
  - Goal: Reduce CPU↔GPU bottleneck

### Testing & Validation
- [ ] **Create performance benchmarking suite**
  - [ ] Compare CPU vs GPU performance (1k, 10k, 100k particles)
  - [ ] Frame time profiling
  - [ ] Memory usage tracking
  - [ ] Generate performance report
  - Metrics: Physics time, render time, memory, FPS

---

## 📌 Priority 2 - v5.2 (Advanced Features)
**Target:** 2025-02-15  
**Status:** Planned

### Simulation Features
- [ ] **Simulation presets system**
  - [ ] Built-in presets: "Chaos", "Harmony", "Solar system"
  - [ ] Custom preset creation/editing
  - [ ] Save/load preset configurations
  - [ ] Share presets via URL

- [ ] **Export/Import system**
  - [ ] Export current state to JSON
  - [ ] Import saved configurations
  - [ ] Validate imported data
  - [ ] URL-based state sharing

### Visualization
- [ ] **Advanced statistics graphs**
  - [ ] Particle count over time
  - [ ] Energy distribution
  - [ ] Collision frequency
  - [ ] Interactive timeline

- [ ] **Visual effects improvements**
  - [ ] Particle glow/bloom
  - [ ] Trail intensity controls
  - [ ] Color interpolation modes
  - [ ] Custom particle shapes

### User Experience
- [ ] **Replay/Recording system**
  - [ ] Record simulation states
  - [ ] Playback with timeline controls
  - [ ] Export to video/GIF
  - [ ] Frame-by-frame analysis

---

## 💡 Priority 3 - Future (v6.0+)
**Target:** TBD  
**Status:** Exploration

### Major Features
- [ ] **3D mode**
  - [ ] Three.js integration
  - [ ] 3D spatial hash
  - [ ] Camera controls
  - [ ] Performance testing

- [ ] **Machine learning integration**
  - [ ] Pattern recognition
  - [ ] Behavior prediction
  - [ ] Auto-optimization
  - [ ] TensorFlow.js exploration

- [ ] **Mobile support**
  - [ ] Touch controls
  - [ ] Responsive UI
  - [ ] Performance optimization for mobile GPUs
  - [ ] Progressive Web App

### Performance
- [ ] **WebAssembly optimization**
  - [ ] Critical path in WASM
  - [ ] Rust/C++ physics engine
  - [ ] Benchmark vs pure JS

- [ ] **Multi-threading**
  - [ ] Web Workers for physics
  - [ ] SharedArrayBuffer
  - [ ] Parallel spatial hash

---

## 📋 Ongoing Maintenance

### Documentation
- [ ] API documentation
- [ ] Code comments cleanup
- [ ] Architecture diagrams
- [ ] Performance tuning guide

### Code Quality
- [ ] Unit tests for core modules
- [ ] Integration tests
- [ ] Performance regression tests
- [ ] Code coverage reports

### Community
- [ ] GitHub Pages demo
- [ ] Usage examples
- [ ] Contributing guidelines
- [ ] Issue templates

---

**Last updated:** 2025-01-07  
**Maintained by:** Manual updates (no automation)
