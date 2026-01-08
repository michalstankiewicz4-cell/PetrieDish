# Petrie Dish Distribution Files

This directory contains compiled single-file versions of Petrie Dish.

## Current Version

**v5.1-C2** - `petrie-dish-v5.0-C1.html` (filename unchanged, contains v5.1-C2 code)
- Advanced GPU Optimizations
- Workgroup size optimization (256 → 512)
- Buffer synchronization improvements (-70-80% transfers)
- Legacy CPU code removed (-152 lines)
- Automatic workgroup benchmark system
- **Status:** Current stable release

## File Naming Convention

```
Format: petrie-dish-vMAJOR.MINOR-PHASE[-SUFFIX].html

Examples:
petrie-dish-v5.0-C1.html          # Current (contains v5.1-C2)
petrie-dish-v5.1-C2-dev.html      # Development version
petrie-dish-v5.1-C2-beta.html     # Beta testing
petrie-dish-v5.2-D1.html          # Next major (Advanced GPU)
```

## Usage

1. Download the HTML file
2. Open in browser with WebGPU support (Chrome 113+, Edge 113+, Opera 99+)
3. No server required - works offline!

**Note:** WebGPU is required. Firefox and Safari not yet supported.

## Performance

**v5.1-C2 Improvements:**
- ~40-50% faster physics (workgroup optimization)
- ~70-80% fewer CPU↔GPU transfers (smart sync)
- Overall: ~2× performance vs v5.0-C1

## Version History

| Version | Date | File Size | Major Features |
|---------|------|-----------|----------------|
| v5.1-C2 | 2025-01-08 | 193KB | Workgroup 512, buffer sync, -152 lines |
| v5.0-C1 | 2025-01-07 | 197KB | WebGPU compute, zero-copy rendering |

## Notes

- WebGPU required (no CPU fallback since v5.1-C2)
- Original source modules available in `/src/`
- For development, use modular version in root directory
- Filename remains `petrie-dish-v5.0-C1.html` but contains v5.1-C2 code
