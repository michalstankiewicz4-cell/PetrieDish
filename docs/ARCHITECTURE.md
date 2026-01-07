# 🏗️ Architecture Documentation

**Project:** Petrie Dish WebGPU Particle Simulator  
**Version:** v5.0-C1  
**Last Updated:** 2025-01-07

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Core Components](#core-components)
4. [Data Flow](#data-flow)
5. [GPU Pipeline](#gpu-pipeline)
6. [UI System](#ui-system)
7. [Performance Optimizations](#performance-optimizations)

---

## Overview

Petrie Dish to zaawansowany symulator cząstek wykorzystujący WebGPU do akceleracji obliczeń fizycznych.

**Kluczowe cechy:**
- 100% WebGPU compute dla fizyki
- Zero-copy rendering pipeline
- 16-kolorowa matryca interakcji
- Draggable UI system (Windows-style)
- Jednoplikowy HTML (easy deployment)

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Browser Window                     │
├─────────────────────────────────────────────────────┤
│  Canvas Layer 1: WebGPU/WebGL (particles)          │
│  Canvas Layer 2: Canvas 2D (UI overlay)            │
└─────────────────────────────────────────────────────┘
         │                        │
         ▼                        ▼
┌──────────────────┐    ┌──────────────────┐
│  GPU Pipeline    │    │   UI System      │
│  - Compute       │    │   - Windows      │
│  - Render        │    │   - Taskbar      │
└──────────────────┘    └──────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│     GPUBufferManager             │
│  - Positions (Float32 x2)        │
│  - Velocities (Float32 x2)       │
│  - Colors (Uint32)               │
│  - Masses (Float32)              │
│  - Active Flags (Uint32)         │
└──────────────────────────────────┘
```

---

## Core Components

### 1. WebGPU Detection & Init
**File Location:** Lines 109-184  
**Purpose:** Detect WebGPU support i initialize GPU device
