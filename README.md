# 🧫 Petrie Dish - WebGPU Particle Simulator

**Zaawansowany symulator cząstek z physics engine na GPU i 16-kolorową matrią interakcji**

## 🚀 Aktualna Wersja: v5.0-C1

**Status:** ✅ Stable  
**Data:** 2025-01-07  
**Features:** WebGPU Zero-Copy Rendering, GPU Buffer Manager, UI Optimization

---

## 📂 Struktura Projektu

```
Akcelerator/
├── stable/                          # 📦 Stabilne wersje produkcyjne
│   └── petrie-dish-v5.0-C1.html    # Aktualna stable version
├── dev/                             # 🔧 Wersje rozwojowe
│   └── petrie-dish-v5.1-C2-dev.html # Następna wersja (Full GPU)
├── experiments/                     # 🧪 Eksperymenty i prototypy
├── docs/                            # 📚 Dokumentacja
├── CHANGELOG.md                     # Historia zmian
├── TODO.md                          # Lista zadań
└── KNOWN_ISSUES.md                  # Znane problemy
```

---

## 🎯 Roadmap

### ✅ Phase C1 (v5.0) - COMPLETED
- WebGPU detection & initialization
- GPU Buffer Manager
- Zero-copy rendering pipeline
- Text measurement cache (2-5× UI speedup)
- Matrix rendering optimization

### 🔄 Phase C2 (v5.1) - IN PROGRESS
**Goal:** Full GPU Migration - 100% compute na GPU

**Plan:**
- [ ] Audit & identyfikacja legacy CPU code
- [ ] Migracja physics do GPU compute shaders
- [ ] Usunięcie updateParticles() CPU function
- [ ] Pipeline optimization
- [ ] Benchmarking

**Timeline:** 1-2 tygodnie

### 📋 Phase C3 (v5.2) - PLANNED
- Advanced shader optimization
- Extended color matrix (32 colors?)
- Export/Import configurations

---

## 🏗️ Architektura

### Główne Komponenty

**1. WebGPU Physics Engine**
- Compute shaders dla fizyki
- GPU Buffer Manager (position, velocity, mass, color)
- Zero-copy rendering pipeline

**2. UI System**
- BaseWindow class (draggable windows)
- Taskbar (Windows-style)
- Stats monitoring
- Matrix editor (16×16 interaction grid)

**3. Particle System**
- 16 typów cząstek
- Konfigurowalna matryca interakcji
- Spatial hash optimization
- GPU rendering

---

## 🔧 Tech Stack

- **Rendering:** WebGPU (fallback: WebGL)
- **Physics:** GPU Compute Shaders
- **UI:** Canvas 2D (optimized)
- **Language:** Pure JavaScript (ES6+)
- **Format:** Jednoplikowy HTML (easy deployment)

---

## 🚦 Jak Używać

1. Otwórz `stable/petrie-dish-v5.0-C1.html` w przeglądarce
2. Wymagania:
   - Chrome 113+ lub Edge 113+ (dla WebGPU)
   - Fallback na CPU dla starszych przeglądarek

---

## 📝 System Wersjonowania

```
Format: vMAJOR.MINOR-PHASE[-SUFFIX]

Examples:
v5.0-C1          ← Stable release
v5.1-C2-dev      ← Development version
v5.1-C2-rc1      ← Release candidate
v6.0-D1          ← Major version bump
```

**MAJOR** - Breaking changes, przepisanie architektury  
**MINOR** - Nowe features, optymalizacje  
**PHASE** - Fazy rozwoju (A, B, C, D...)  
**SUFFIX** - dev/beta/rc/hotfix

---

## 🤝 Contributing

Ten projekt jest obecnie w fazie aktywnego rozwoju.  
Development workflow:

1. Branch: `git checkout -b feature/nazwa`
2. Pracuj na: `dev/petrie-dish-vX.X-XX-dev.html`
3. Commit: `git commit -m "feat: opis zmiany"`
4. Merge: po testach → `stable/`

---

## 📄 Licencja

TBD

---

## 👤 Autor

Michal Stankiewicz (michalstankiewicz4-cell)

**Contact:** michalstankiewicz4@gmail.com  
**GitHub:** https://github.com/michalstankiewicz4-cell/Claude
