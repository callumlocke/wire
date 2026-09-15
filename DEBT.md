# Technical debt

## `Directory.watch()` resolves before the initial callback runs

**Location:** [`core/Directory.ts`](core/Directory.ts), `watch()`.

The documented contract says that `watch()` resolves after the first subscriber
call completes, including any promise returned by that subscriber. In a local
reproduction, the callback had not yet run when `await directory.watch(...)`
returned.

The implementation awaits `Promise.resolve(notify())`, but `notify` is debounced:
its first call schedules the subscriber and returns before executing it. Code
that awaits `watch()` before using the subscriber's initial output can therefore
run too early.

The existing test separately awaits a promise resolved by the subscriber, so it
checks eventual delivery without checking the documented completion timing. Its
`try`/`finally` closes the watcher; it does not catch or swallow assertion failures.

**Follow-up:** Make startup completion track the initial subscriber's completion
and define how an initial subscriber failure affects the returned promise. Add a
regression test that holds an async subscriber open, verifies that `watch()` is
still pending, then releases it and verifies completion.

## Empty-parent cleanup leaves empty directories behind

**Location:** [`core/Directory.ts`](core/Directory.ts), `deleteEmptyParents()`.

This was reproduced on the local macOS environment: create `nested/file.txt`,
call `directory.write({})`, and inspect the directory. The file is deleted, but
the empty `nested` directory remains. This finding came from execution, not the
TODO comments.

The cleanup attempts `fs.unlink(parent)` on a directory and treats `EPERM` as a
reason to stop. That does not establish whether the directory is nonempty, and
the intended pruning does not occur. Existing deletion tests check file removal
but do not assert that empty parent directories disappear.

**Follow-up:** Use an appropriate nonrecursive directory-removal operation and
handle expected missing/nonempty-directory errors explicitly. Preserve the
managed root and directories containing other files. Test nested empty-parent
removal, retained siblings, and root preservation; check error behavior on the
supported platforms.

## `withPatch` advances its history after a failed attempt

**Location:** [`core/withPatch.ts`](core/withPatch.ts).

`previousFiles` is updated before the callback runs or settles. A local
reproduction confirmed that a failed attempt with `file.txt` in its patch,
followed by identical input, gives the retry an empty patch.

A callback that processes only patch entries may consequently skip work that
never completed successfully. The current failure tests verify that later calls
can execute, but do not inspect the patch supplied to a retry.

**Follow-up:** Decide whether patches describe changes since the last attempt or
the last successful callback. The current documentation says "last time the
transform was called," so this needs an explicit contract decision. If successful
completion is the intended baseline, update history only after the callback
succeeds. Test identical-input retries after both synchronous throws and async
rejections, including a failure after an earlier successful call.

## A rejected `Directory` operation blocks subsequent operations

**Location:** [`core/Directory.ts`](core/Directory.ts), `whenIdle()`.

The queue retains each operation's promise. Subsequent operations attach only a
success handler with `.then(...)`, so one rejection causes later operations to
inherit that rejection without running their bodies. Catching the original error
at the call site does not repair the internal queue.

This was reproduced by attempting a forbidden write while watching, catching its
error, and then calling `read()` on the same instance. The read rejected with the
previous write error. The existing test checks the write rejection but stops
before attempting another operation.

**Follow-up:** Separate the result returned to the caller from the queue's ability
to continue after failure. Preserve the failing operation's rejection while
allowing subsequent work to run in order. Add regression tests for operations
already queued behind a failure and operations submitted after the caller catches
it. [`core/lib/singleFile.ts`](core/lib/singleFile.ts) already schedules callbacks
after either fulfillment or rejection and provides a useful comparison.
