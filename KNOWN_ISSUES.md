# Known Issues

> Current bugs, limitations, and technical debt

**Last Updated:** 2025-01-07  
**Version:** v5.0-C1

---

## 🚨 Critical Issues

*No critical issues currently*

---

## ⚠️ Medium Priority

### GPU Rendering Compatibility
**Issue:** WebGPU canvas context fails if WebGL context already exists  
**Impact:** GPU rendering disabled, falls back to WebGL  
**Workaround:** Refresh page before running simulation  
**Status:** Known limitation - requires canvas recreation  
**Planned Fix:** v5.1-C2 - Better context management

### WebGL Fallback Path
**Issue:** WebGL fallback not fully tested with all features  
**Impact:** Some visual effects may not work correctly  
**Symptoms:**
- Particle trails may flicker
- Color interpolation inconsistent
- Performance degradation with >50k particles
**Status:** Testing in progress  
**Planned Fix:** v5.2 - Comprehensive fallback testing

### Legacy Code Pollution
**Issue:** ~~CPU physics code still present alongside GPU code~~ **✅ FIXED in v5.1-C2**  
**Resolution:** All legacy CPU physics code removed (-152 lines)
- Removed: `Particle.update()`, `applyParticleInteractions()`, `applyForcesBetween()`, `SpatialHash` class
- Added: WebGPU Required error screen for unsupported browsers
- Impact: Single GPU implementation, cleaner codebase, easier maintenance
**Status:** ✅ **RESOLVED in v5.1-C2**

---

## 💭 Low Priority

### Text Cache Memory Growth
**Issue:** Text measurement cache can grow unbounded in theory  
**Impact:** Minimal - LRU eviction at 1000 entries prevents issues  
**Status:** Monitoring  
**Notes:** Not observed in practice, but could be optimized

### Mobile Performance
**Issue:** No mobile optimization  
**Impact:** Poor performance on mobile devices  
**Status:** Not planned for current phase  
**Future:** v5.3 - Mobile support

### Browser Compatibility
**Issue:** WebGPU only in Chrome 113+, Edge 113+  
**Impact:** Firefox, Safari users must use WebGL fallback  
**Status:** Waiting for browser support  
**Workaround:** Use Chrome/Edge for best experience

---

## 🔍 Under Investigation

### Occasional Frame Drops
**Reported:** Intermittent frame drops with >80k particles  
**Frequency:** Rare (< 1% of frames)  
**Suspected Cause:** GPU compute timeout or memory pressure  
**Status:** Profiling needed  
**Priority:** Low (doesn't affect usability)

### Memory Usage Growth
**Reported:** Slow memory growth over extended runs (>30 min)  
**Measured:** ~2MB/hour  
**Suspected Cause:** Particle trail history not garbage collected  
**Status:** Monitoring  
**Priority:** Low (within acceptable limits)

---

## 📋 Technical Debt

### Architecture
- [ ] **Monolithic file structure** (4398 lines)
  - ✅ FIXED: v5.1 - Split into modules
- [ ] **Global variables** scattered throughout
  - Priority: Medium
  - Planned: Refactor to module-scoped
- [ ] **Mixed concerns** (rendering + physics + UI)
  - Priority: Low
  - Planned: Better separation of concerns

### Code Quality
- [ ] **Missing JSDoc comments** for many functions
  - Priority: Medium
  - Planned: Ongoing documentation effort
- [ ] **No type checking** (pure JavaScript)
  - Priority: Low
  - Future: Consider TypeScript migration
- [ ] **Magic numbers** without constants
  - Priority: Low
  - Ongoing: Gradual cleanup

### Testing
- [ ] **No automated tests**
  - Priority: High
  - Planned: v5.2 - Unit test framework
- [ ] **No performance regression tests**
  - Priority: Medium
  - Planned: v5.2 - Benchmarking suite

---

## 🔧 Workarounds

### Issue: GPU Device Lost
**When:** GPU driver crash or system sleep  
**Workaround:** Refresh page  
**Permanent Fix:** v5.2 - Device recovery handling

### Issue: High Memory Usage
**When:** >90k particles for extended periods  
**Workaround:** Reduce particle count or restart simulation  
**Permanent Fix:** v5.2 - Better memory management

### Issue: UI Lag
**When:** Many windows open simultaneously  
**Workaround:** Close unused windows  
**Permanent Fix:** v5.1-C2 - Optimized UI rendering

---

## 📊 Performance Limitations

| Scenario | Limit | Reason | Status |
|----------|-------|--------|--------|
| Max Particles | 100,000 | GPU buffer size | By design |
| Max Windows | ~10 | UI rendering cost | Can be optimized |
| Canvas Size | 4096×4096 | WebGL/WebGPU limit | Hardware limit |
| Compute Workgroup | 256 | GPU architecture | Hardware limit |

---

## 🎯 Resolution Priority

**Priority Matrix:**

| Impact → | High | Medium | Low |
|----------|------|--------|-----|
| **Frequency: High** | 🚨 Critical | ⚠️ Important | 💭 Monitor |
| **Frequency: Medium** | ⚠️ Important | 💭 Monitor | 📋 Backlog |
| **Frequency: Low** | 💭 Monitor | 📋 Backlog | 📋 Backlog |

---

## 📝 Reporting Issues

If you discover a new issue:

1. Check if it's already listed here
2. Verify it's reproducible
3. Note browser, GPU, and particle count
4. Document steps to reproduce
5. Open GitHub issue with details

---

**Issue Status Legend:**
- 🚨 Critical - Blocks core functionality
- ⚠️ Medium - Reduces functionality or performance
- 💭 Low - Minor inconvenience
- 🔍 Under Investigation - Being analyzed
- 📋 Technical Debt - Cleanup needed
- ✅ Fixed - Resolved in specified version
