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
- [x] **Optimize GPU compute shader dispatch** ✅ DONE 2025-01-08
  - [x] Benchmark different workgroup sizes (tested: 64, 128, 256, 512, 1024, 2048)
  - [x] Test on actual hardware (GPU max: 512)
  - [x] Measure physics time for each configuration
  - [x] Document optimal configuration
  - Result: 512 is optimal (2x improvement over default 256)
  - Impact: Better GPU utilization, ~40-50% faster physics
  - Note: 1024+ not supported on test GPU

- [x] **Improve buffer synchronization** ✅ DONE 2025-01-07
  - [x] Conditional download (only when GPU rendering disabled)
  - [x] Dirty flag system for simulation parameters
  - [x] Dirty flag system for integration parameters
  - [x] Eliminate redundant CPU↔GPU transfers
  - Impact: ~70-80% reduction in CPU↔GPU transfers
  - Result: Better framerate, reduced GPU memory bandwidth

### Testing & Validation
- [ ] **Create performance benchmarking suite**
  - [ ] Compare CPU vs GPU performance (1k, 10k, 100k particles)
  - [ ] Frame time profiling
  - [ ] Memory usage tracking
  - [ ] Generate performance report
  - Metrics: Physics time, render time, memory, FPS

---

## 📌 Priority 2 - v5.2 (Advanced GPU Optimizations)
**Target:** 2025-02-28  
**Status:** Planned  
**Goal:** 10-100x performance improvement, 100k-1M particles @ 60 FPS

### 🔥 LEVEL 2: Advanced GPU Techniques (HIGHEST IMPACT)

- [ ] **Shared Memory Optimization** ⭐⭐⭐ (PRIORITY #1)
  - [ ] Implement workgroup shared memory for position/velocity data
  - [ ] Reduce global memory reads from O(n²) to O(n)
  - [ ] Optimize memory access patterns
  - [ ] Benchmark performance improvement
  - Expected gain: 3-10x faster physics
  - Difficulty: Medium
  - Time estimate: 3-4 hours

- [ ] **GPU Spatial Hashing** ⭐⭐⭐ (PRIORITY #2)
  - [ ] Implement spatial hash grid on GPU
  - [ ] Compute shader for hash table construction
  - [ ] Neighbor search in O(1) instead of O(n)
  - [ ] Handle hash collisions efficiently
  - Expected gain: 100-1000x for large simulations (10k+ particles)
  - Difficulty: Hard
  - Time estimate: 6-8 hours

- [ ] **Barnes-Hut Algorithm** ⭐⭐
  - [ ] Implement quad-tree on GPU
  - [ ] Tree construction in compute shader
  - [ ] Force calculation with tree traversal
  - [ ] O(n log n) instead of O(n²)
  - Expected gain: 60x for 100k particles
  - Difficulty: Hard
  - Time estimate: 8-10 hours

### ⚡ LEVEL 3: Rendering Optimizations

- [ ] **GPU-Driven Rendering** ⭐⭐
  - [ ] Indirect draw calls (drawIndirect)
  - [ ] GPU-based culling in compute shader
  - [ ] Zero CPU overhead for draw commands
  - [ ] Automatic LOD system
  - Expected gain: 2-5x render performance
  - Difficulty: Medium-Hard
  - Time estimate: 4-5 hours

- [ ] **Compute Shader Culling** ⭐
  - [ ] Frustum culling on GPU
  - [ ] Skip off-screen particles
  - [ ] Visibility buffer generation
  - Expected gain: 2-3x render performance
  - Difficulty: Medium
  - Time estimate: 2-3 hours

- [ ] **Post-Processing Pipeline** ⭐
  - [ ] Bloom/Glow effects
  - [ ] Motion blur
  - [ ] Heat distortion
  - [ ] Chromatic aberration
  - Impact: Visual quality boost
  - Difficulty: Medium
  - Time estimate: 3-4 hours

### 🌟 LEVEL 4: Physics Improvements

- [ ] **Verlet Integration** ⭐⭐
  - [ ] Replace Euler with Verlet integrator
  - [ ] More stable physics simulation
  - [ ] Remove velocity buffer (saves memory)
  - [ ] Position-based dynamics
  - Impact: Better stability, less memory
  - Difficulty: Medium
  - Time estimate: 2-3 hours

- [ ] **Fixed Timestep** ⭐
  - [ ] Decouple physics from render framerate
  - [ ] Deterministic simulation
  - [ ] Frame-independent behavior
  - [ ] Accumulator pattern
  - Impact: Consistent physics regardless of FPS
  - Difficulty: Easy
  - Time estimate: 1-2 hours

- [ ] **Particle Collisions** ⭐⭐
  - [ ] Sphere-sphere collision detection
  - [ ] Elastic collision response
  - [ ] Impulse-based resolution
  - [ ] Energy conservation
  - Impact: New physics dimension (billiards, gases)
  - Difficulty: Hard
  - Time estimate: 4-6 hours

### 📊 LEVEL 5: Scale Up

- [ ] **1 Million Particles Support** ⭐⭐⭐
  - [ ] Optimize all systems for 1M particles
  - [ ] Memory management for large counts
  - [ ] Streaming/pagination if needed
  - [ ] Performance validation
  - Goal: 1M particles @ 60 FPS
  - Dependencies: Shared memory + Spatial hash
  - Difficulty: Hard
  - Time estimate: 10-12 hours

- [ ] **Web Workers for CPU Tasks** ⭐
  - [ ] Multi-threaded statistics
  - [ ] Async collision detection fallback
  - [ ] Background data processing
  - Impact: Better CPU utilization
  - Difficulty: Medium
  - Time estimate: 3-4 hours

### 🧪 LEVEL 6: New Physics Features

- [ ] **Chemistry Simulation** ⭐⭐
  - [ ] Particle reactions (Red + Blue → Purple)
  - [ ] Reaction rules system
  - [ ] Energy transfer in reactions
  - [ ] Molecule formation
  - Impact: New gameplay/education possibilities
  - Difficulty: Hard
  - Time estimate: 6-8 hours

- [ ] **Temperature & Phase States** ⭐⭐
  - [ ] Temperature property per particle
  - [ ] Solid/Liquid/Gas phase states
  - [ ] Heat transfer between particles
  - [ ] State transitions
  - Impact: Realistic thermodynamics
  - Difficulty: Medium-Hard
  - Time estimate: 4-5 hours

- [ ] **Gravity Wells & Orbits** ⭐
  - [ ] Point mass gravity sources
  - [ ] Orbital mechanics
  - [ ] N-body simulation
  - [ ] Black holes, planets, stars
  - Impact: Astrophysics simulation
  - Difficulty: Medium
  - Time estimate: 3-4 hours

---

## 📌 Priority 3 - v5.3 (User Features)
**Target:** 2025-03-15  
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
