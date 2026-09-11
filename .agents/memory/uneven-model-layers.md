---
name: Uneven model layers
description: Durable constraints for versioned assessment models whose layers can contain different numbers of capabilities
---

The assessment model is append-only and layer sizes are versioned content. A future model may have
uneven layers, so database constraints must permit the largest supported order and application seed
logic must flatten capabilities in ordered model sequence rather than using layer_index × 6.

**Why:** The v2.2 revision introduced an eight-capability Department layer while v2.1 retained six
per layer. The original schema constraint and demo seed index both silently encoded the old shape.

**How to apply:** When adding a model revision, inspect layer/order constraints, generate a new
forward-only migration, validate every seed vector against the current capability count, and derive
all scoring maxima from the capability rows.