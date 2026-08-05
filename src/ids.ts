/**
 * ids.ts
 *
 * Deterministic ID allocation for OOXML parts. Duplicate `cNvPr id`,
 * duplicate `rIdN`, and `sldId < 256` are the exact three defect classes
 * `validate_pptx_unpacked.py` (Gate A) exists to catch — meaning they were
 * common enough in LM-authored XML to warrant a dedicated script. Moving
 * allocation into stateful TS objects makes the defect unrepresentable
 * instead of merely detectable-after-the-fact.
 */

/**
 * Allocates unique `<p:cNvPr id="N">` shape IDs within a single slide.
 * Mirrors the documented convention:
 *   base_id = (slide_number - 1) * 100 + 1
 * so IDs never collide across slides either, even though uniqueness is
 * only strictly required per-slide.
 */
export class ShapeIdAllocator {
  private next: number;
  private readonly issued = new Set<number>();

  constructor(slideNumber: number) {
    if (!Number.isInteger(slideNumber) || slideNumber < 1) {
      throw new Error(`ShapeIdAllocator: slideNumber must be a positive integer, got ${slideNumber}`);
    }
    this.next = (slideNumber - 1) * 100 + 1;
  }

  /** Allocates and returns the next unused shape id for this slide. */
  alloc(): number {
    const id = this.next++;
    this.issued.add(id);
    return id;
  }

  /** Allocates `count` ids at once, useful for a pattern that needs N boxes. */
  allocMany(count: number): number[] {
    return Array.from({ length: count }, () => this.alloc());
  }

  /** All ids issued so far by this allocator (for validation/debugging). */
  issuedIds(): number[] {
    return [...this.issued];
  }
}

/**
 * Allocates unique `Id="rIdN"` relationship IDs for a single `.rels` part
 * (e.g. one slide's `_rels/slideN.xml.rels`, or `presentation.xml.rels`).
 * Optionally seeded with IDs already present in a template being extended,
 * so newly allocated IDs never collide with pre-existing ones.
 */
export class RidAllocator {
  private next = 1;
  private readonly used = new Set<number>();

  /** Reserve IDs already present (e.g. from a cloned template) before allocating new ones. */
  reserve(existingRids: Iterable<string>): void {
    for (const rid of existingRids) {
      const n = RidAllocator.parse(rid);
      if (n !== null) this.used.add(n);
    }
  }

  alloc(): string {
    while (this.used.has(this.next)) this.next++;
    this.used.add(this.next);
    return `rId${this.next++}`;
  }

  private static parse(rid: string): number | null {
    const m = /^rId(\d+)$/.exec(rid);
    return m ? Number(m[1]) : null;
  }
}

/**
 * Allocates unique `<p:sldId id="N">` values in `presentation.xml`.
 * PowerPoint reserves IDs below 256 — the validator flags any `sldId < 256`
 * as an error, so this allocator starts at 256 and cannot produce an
 * invalid value.
 */
export class SldIdAllocator {
  private next = 256;
  private readonly used = new Set<number>();

  reserve(existingIds: Iterable<number>): void {
    for (const id of existingIds) this.used.add(id);
    // Keep `next` ahead of any reserved id so freshly allocated ids never
    // collide with the reserved set even if it's sparse.
    for (const id of this.used) {
      if (id >= this.next) this.next = id + 1;
    }
  }

  alloc(): number {
    while (this.used.has(this.next)) this.next++;
    const id = this.next++;
    this.used.add(id);
    return id;
  }
}
