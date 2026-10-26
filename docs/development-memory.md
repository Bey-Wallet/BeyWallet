# Local development memory

## Recommended commands

On an 8 GB machine, use `yarn start:low-memory`. It runs the installed Expo CLI with
`--max-workers 1`, sets `--max-old-space-size=3072` on Expo's Node process, and retains Metro's
transform cache. One worker runs transformations in Metro's main process instead of creating
a parallel worker pool. The heap setting raises the old-generation ceiling to 3 GB without
reserving that memory in advance; total process memory can exceed that ceiling. It does not
change global `NODE_OPTIONS`, other Node programs, or the separate esbuild process.

- `yarn start`: reuse the cache with Expo's default worker count and Node heap limit.
- `yarn start:clean`: explicitly clear Metro's cache, using the default workers and heap limit.
- `yarn start:low-memory --clear`: explicitly clear the cache with one worker.

Stop the current server with Ctrl+C in its terminal before switching commands. Keep one
development server running, use a physical device with a development build, and use EAS for
native builds when local Gradle or an emulator would compete for RAM. These startup commands
do not require Bun and do not change EAS configuration.

## Investigation on October 26, 2026

The machine has approximately 8 GB physical RAM. Only about 0.7-0.8 GB was free during the
initial inspection. The installed runtime is 64-bit Node 24.10.0; a fresh Node process reported
a default V8 heap limit of approximately 2,240 MiB. This is a per-process heap limit, not the
total memory allowance for Expo, its workers, and esbuild.

The existing Expo process on port 8081 had six Node worker children and one esbuild child.
Its sampled idle process tree used approximately 731 MiB working set and 560 MiB private
memory. This is an idle observation, not a comparable cold-bundle benchmark.

A temporary server on port 8085 was started with:

```bash
yarn start:low-memory --offline --port 8085 --dev-client
```

Its process tree contained one Node process and one esbuild process, without Node worker
children. Development transform logs reported zero optimized/flattened Tamagui candidates,
consistent with the existing development extraction setting. No Tamagui, package-resolution,
dependency, or heap-limit changes were made.

### Bundle verification

- A full Android development bundle completed successfully, without clearing existing caches
  or increasing the heap. Metro reported approximately 294 seconds for the first build.
- The initial HTTP probe timed out after four minutes while Metro continued compiling. A
  subsequent probe returned HTTP 200 with the complete 26,806,197-byte bundle.
- Three subsequent requests all returned HTTP 200 in approximately 1.35, 0.87, and 1.33 seconds.
  Metro reported roughly 0.24-0.35 seconds of bundling for these requests.
- The highest sampled process-tree private memory was approximately 2,076 MiB. After the warm
  requests, it was approximately 2,057 MiB, with a 1,169 MiB working set. These are samples, not
  a continuous peak-memory guarantee or a long-running leak test.
- After stopping and restarting the temporary server without clearing caches, the full bundle
  again returned HTTP 200. Metro reported 3.3 seconds of bundling for 4,805 modules. The HTTP
  request took approximately 89 seconds including startup readiness/file-map work; the bundle
  time alone is not the end-to-end restart time.
- After that cached-restart request, the process tree used approximately 1,024 MiB private
  memory and an 835 MiB working set. Both temporary server runs were stopped afterward; the
  original server on port 8081 was preserved.

The existing package-exports fallback warnings for `cborg` and nested `@noble/hashes` imports
were observed. Resolution settings were preserved; no dependency changes were needed for these
successful bundles. Both the default and low-memory servers existed during measurement, so
these results are observations under memory pressure, not an isolated before/after benchmark.

### Confirmed Node heap failure

The user subsequently supplied a crash from PID 2052, at approximately 227 seconds:
`FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`.
The final collection reduced about 2,046 MiB of live heap to only about 2,045 MiB. This confirms
a Node/V8 heap-ceiling failure. It does not identify which objects retained memory or establish
a leak, nor does it implicate esbuild's separate heap. The earlier successful bundle checks
were insufficient to establish that the original two-gigabyte ceiling was safe.

At follow-up inspection, no Expo listener remained on ports 8081 or 8085, and approximately
2.3 GB of physical RAM was free, with additional Windows commit headroom. The low-memory
command now keeps one worker and gives only Expo's Node process a 3 GB old-generation limit.
This is a bounded mitigation for the confirmed ceiling, not a claim that memory growth is fixed.

The updated command was verified on a temporary server with `--clear --offline --port 8085
--dev-client`. The running process's command line included both `--max-old-space-size=3072`
and `--max-workers 1`. A fresh Node process with that heap flag reported a total V8 heap limit
of 3,264 MiB (the flag controls old generation, not the entire heap).

- The cache-cleared Android build completed: 4,805 modules, Metro bundle time approximately
  237 seconds, HTTP 200, and a complete 26,806,197-byte response. The HTTP probe took about
  253 seconds including readiness/response overhead.
- Twenty sequential cached full-bundle requests all returned HTTP 200 with the same byte count
  in 11.2 seconds total. These were cached reloads, not edits or device Fast Refresh cycles.
- Sampled process-tree private memory was approximately 2,296 MiB after the first bundle and
  2,381 MiB after the reload check. This short test does not establish a steady state or rule
  out longer-term retained-memory growth.
- Formatting and whitespace checks passed. The temporary server was stopped after verification.

## Remaining acceptance checks

- On a physical device, check Home, Settings, Send, Receive, and Scanner, then make at least
  20 edits/Fast Refresh cycles and check that memory settles rather than growing indefinitely.
- If a failure recurs, capture its exact message and failing process. If the 3 GB heap also
  fills or grows across refreshes, profile retained memory and the module graph before raising
  the limit again. Keep enough headroom for Windows and close unused development tools.

Working set measures resident RAM; private memory may include paged-out memory. Neither is
the same as V8 heap usage. Results vary with caches, other applications, and Windows paging.

## References

- [Metro worker and cache configuration](https://metrobundler.dev/docs/configuration/)
- [Node memory options](https://nodejs.org/api/cli.html#--max-old-space-sizesize-in-mib)
