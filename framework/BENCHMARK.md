# web performance evidence

The intended advantage is architectural: exact semantic dependencies can update exact observable projections without a component-tree rerender or virtual-DOM diff. That is a target, not a result implied by the framework name.

Every comparison must report separately:

- HTML and JavaScript/Wasm transfer bytes, compressed and uncompressed;
- cold startup and first useful paint;
- hydration/resumption work;
- update latency and DOM mutations for one-value, list and cross-view changes;
- CPU time, memory and allocations;
- server/edge execution and origin subrequests;
- build and compile time;
- runtime artifact identity from `/runtime/manifest.json`;
- comparator versions and production settings.

Required controls:

1. Static page where every framework should approach zero runtime work.
2. Fine-grained update where only one text/attribute projection changes.
3. Keyed list insertion/removal/reorder.
4. Effectful API interaction through the same network boundary.
5. Cold edge/browser startup.
6. A deliberately broad dependency so Idol cannot win by omitting required work.

Until these controls are executed on the deployed artifact, describe `shared/web.js` as the semantic dependency bridge and Idol Wasm as not yet admitted when the runtime manifest says `available: false`.
