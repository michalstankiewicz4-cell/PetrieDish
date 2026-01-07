# 🐛 Known Issues

**Last Updated:** 2025-01-07  
**Version:** v5.0-C1

---

## 🔴 Critical Issues

**None currently** ✅

---

## 🟡 Medium Priority Issues

### 1. Legacy CPU Physics Code
**Status:** 📋 Planned for removal in v5.1-C2  
**Impact:** Zaśmieca codebase, zwiększa maintenance cost  
**Description:**
- Stary kod CPU physics nadal obecny w projekcie
- Funkcje typu `updateParticles()` nieużywane gdy WebGPU aktywne
- ~500 linii dead code

**Workaround:** Użyj WebGPU (domyślnie włączone)  
**Fix ETA:** v5.1-C2 (1-2 tygodnie)

---

### 2. WebGL Fallback Not Fully Tested
**Status:** ⚠️ Needs testing  
**Impact:** Może nie działać na starszych przeglądarkach  
**Description:**
- WebGL fallback path istnieje ale nie jest dokładnie przetestowany
- Możliwe rendering artifacts
- Performance może być gorsze niż oczekiwane

**Workaround:** Użyj Chrome 113+ dla WebGPU  
**Fix ETA:** v5.2-C3 (low priority)

---

### 3. Canvas Resize Flash
**Status:** 🐛 Minor visual bug  
**Impact:** Drobne visual glitch przy resize  
**Description:**
- Przy zmianie rozmiaru okna przeglądarki może wystąpić krótki flash
- Nie wpływa na funkcjonalność
- Canvas clearing timing issue

**Workaround:** Ignoruj flash, trwa <50ms  
**Fix ETA:** TBD (low priority)

---

## 🟢 Low Priority Issues

### 4. Text Cache Growth
**Status:** 💭 Optimization opportunity  
**Impact:** Minimalny - cache ma limit 1000 entries  
**Description:**
- TextWidthCache może rosnąć przy dużej liczbie dynamicznych labels
- LRU eviction działa, ale nie jest optymalny
- Możliwe micro-optymalizacje

**Workaround:** Cache ma hard limit, nie stanowi zagrożenia  
**Fix ETA:** Może w przyszłości (very low priority)

---

### 5. Window Drag Jitter
**Status:** 🐛 Cosmetic issue  
**Impact:** Minimalny - tylko przy bardzo szybkim ruchu myszą  
**Description:**
- Przy bardzo szybkim przeciąganiu okien może wystąpić "skok"
- Mouse position sampling rate issue
- Występuje tylko przy ekstremalnych ruchach

**Workaround:** Przeciągaj wolniej  
**Fix ETA:** TBD (cosmetic)

---

### 6. Stats Update in Pause
**Status:** 📋 Feature request  
**Impact:** Bardzo niski - tylko estetyka  
**Description:**
- Okno Stats nie aktualizuje się gdy symulacja w pauzie
- To jest celowe (nie ma nowych danych), ale może być mylące
- Rozważyć dodanie tekstu "PAUSED"

**Workaround:** Wznów symulację, żeby zobaczyć aktualne stats  
**Fix ETA:** TBD (nice to have)

---

### 7. GPU Error Console Spam
**Status:** 🐛 Logging issue  
**Impact:** Bardzo niski - tylko developer console  
**Description:**
- W przypadku błędów GPU (np. brak WebGPU) console może być spamowany
- Error handling działa poprawnie, ale logging mógłby być czystszy
- Nie wpływa na użytkownika (tylko dev tools)

**Workaround:** Ignoruj console spam  
**Fix ETA:** TBD (cleanup issue)

---

## 🔍 Under Investigation

**None currently**

---

## ✅ Recently Fixed

### Canvas Context Initialization (v5.0-C1)
**Fixed:** 2025-01-07  
**Issue:** WebGPU canvas context nie inicjalizował się poprawnie  
**Solution:** Dodano proper error handling i fallback

### Memory Leaks in Particle System (v5.0-C1)
**Fixed:** 2025-01-07  
**Issue:** Buffers nie były properly disposed  
**Solution:** Dodano cleanup w GPUBufferManager

### Text Measurement Performance (v5.0-C1)
**Fixed:** 2025-01-07  
**Issue:** measureText() wywoływane 100+ razy per frame  
**Solution:** Dodano LRU cache (OPT-4) → 2-5× speedup

---

## 📝 Reporting Issues

Jeśli znajdziesz nowy issue:

1. **Sprawdź** czy już nie jest listed tutaj
2. **Zbierz info:**
   - Browser & version
   - OS & version
   - Steps to reproduce
   - Expected vs actual behavior
   - Console errors (jeśli są)
3. **Dodaj** do tego pliku lub otwórz GitHub Issue

---

## 🎯 Priority Levels

- 🔴 **Critical** - Blokuje użycie, wymaga natychmiastowej naprawy
- 🟡 **Medium** - Wpływa na funkcjonalność, planowana naprawa
- 🟢 **Low** - Kosmetyczne, nie wpływa na core funkcjonalność
- 💭 **Enhancement** - Nie bug, ale możliwość ulepszenia

---

**Legend:**
- ✅ Fixed
- 🐛 Active bug
- 📋 Planned fix
- ⚠️ Needs investigation
- 💭 Enhancement opportunity
