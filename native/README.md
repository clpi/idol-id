# Native Idol runtime sources

Files below this directory are canonical `.id` source inputs for public runtime
projections. They do not create a second language authority: every source file
is compiled by the exact `clpi/idol` revision pinned in `runtime/authority.json`.

Generated WebAssembly and JSON projections must retain source, compiler, native,
and artifact hashes. A projection that cannot be regenerated or byte-verified is
not admitted.
