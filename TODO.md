# 📋 TODO List

**Last Updated:** 2025-01-07

---

## 🔥 Priority 1 - Phase C2 (v5.1) - AKTYWNE

### Full GPU Migration
- [ ] **Audit legacy CPU code**
  - [ ] Zidentyfikować wszystkie funkcje CPU physics
  - [ ] Zmapować które są używane, które legacy
  - [ ] Oszacować effort migracji
  
- [ ] **Migracja physics do GPU**
  - [ ] updateParticles() → GPU compute shader
  - [ ] Collision detection → GPU
  - [ ] Spatial hash → GPU (opcjonalnie)
  - [ ] Force calculations → GPU
  
- [ ] **Cleanup legacy code**
  - [ ] Usunąć CPU updateParticles()
  - [ ] Usunąć nieużywane CPU buffers
  - [ ] Wyczyścić komentarze legacy
  
- [ ] **Testing & Benchmarking**
  - [ ] Test 1,000 particles
  - [ ] Test 10,000 particles
  - [ ] Test 100,000 particles
  - [ ] Porównanie CPU vs GPU performance
  - [ ] Memory leak testing

**Deadline:** 2 tygodnie (do ~2025-01-21)  
**Assignee:** Claude + Michal

---

## 📌 Priority 2 - Phase C3 (v5.2) - PLANOWANE

### Advanced Features
- [ ] **Extended Color System**
  - [ ] Zwiększyć z 16 do 32 kolorów
  - [ ] Redesign UI matrix editor
  - [ ] Optimize matrix storage
  
- [ ] **Export/Import System**
  - [ ] Export configuration jako JSON
  - [ ] Import configuration
  - [ ] Preset library (predefiniowane matrycie)
  - [ ] Share link generation
  
- [ ] **Shader Optimization**
  - [ ] Profile compute shaders
  - [ ] Optymalizacja workgroup size
  - [ ] Reduce GPU memory transfers
  
- [ ] **UI Improvements**
  - [ ] Window snapping (Aero Snap-like)
  - [ ] Keyboard shortcuts
  - [ ] Color picker dla particles
  - [ ] Better tooltips

**Deadline:** TBD  
**Assignee:** TBD

---

## 💡 Ideas - Backlog

### Recording & Playback
- [ ] Record simulation state
- [ ] Playback recorded simulation
- [ ] Timeline scrubbing
- [ ] Export as video/GIF

### Visualization
- [ ] Heatmap overlay (density visualization)
- [ ] Velocity field visualization
- [ ] Energy graph
- [ ] Particle trails

### Physics Features
- [ ] Gravity wells
- [ ] Boundary conditions (wrap/bounce/kill)
- [ ] Custom force fields
- [ ] Particle spawning patterns

### Developer Tools
- [ ] Performance profiler
- [ ] Shader debugger
- [ ] Memory monitor
- [ ] GPU utilization graph

### Multi-Platform
- [ ] Mobile touch support
- [ ] Responsive UI
- [ ] PWA support
- [ ] Offline mode

---

## 🐛 Known Bugs to Fix

### Critical
- None currently

### Medium
- [ ] WebGL fallback not fully tested
- [ ] Canvas resize może powodować flash
- [ ] Text cache może rosnąć przy dynamicznych labelach

### Low Priority
- [ ] Drag window czasem "skacze" przy szybkim ruchu
- [ ] Stats nie aktualizują się w pause
- [ ] Console spam przy GPU errors

---

## 🧹 Technical Debt

- [ ] Refactor GPUBufferManager (zbyt duża klasa)
- [ ] Split main HTML na moduły (jeśli będzie potrzeba)
- [ ] Add TypeScript definitions (opcjonalnie)
- [ ] Improve error handling
- [ ] Add unit tests (jeśli projekt urośnie)
- [ ] Documentation (inline comments w key functions)

---

## 📊 Metrics & Goals

### Performance Targets
- **FPS:** 60 @ 10,000 particles (GPU)
- **Memory:** < 100 MB @ 50,000 particles
- **Startup:** < 2s to first frame

### Code Quality
- **Lines of Code:** Keep under 5,000 (current: ~4,400)
- **Functions:** Prefer small, focused functions
- **Comments:** All major sections documented

### User Experience
- **Load Time:** < 1s (single file HTML)
- **Responsive:** Work on 1920×1080 to 1280×720
- **Intuitive:** No tutorial needed for basic use

---

**Notes:**
- Items marked with [ ] are not started
- Items marked with [x] are completed
- Priority może się zmieniać based on feedback
