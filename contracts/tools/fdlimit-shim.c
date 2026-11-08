/*
 * fdlimit-shim: lets the near-workspaces sandbox node start in containers
 * whose hard open-files limit is below the 65535 neard asks for.
 *
 * neard calls setrlimit(RLIMIT_NOFILE, 65535) at startup and exits if it
 * fails. This LD_PRELOAD shim clamps that request to the current hard limit,
 * so the call succeeds with the highest limit the container allows. Nothing
 * else is changed. Only used by scripts/test-contracts.sh when needed.
 */
#define _GNU_SOURCE
#include <dlfcn.h>
#include <sys/resource.h>
#include <sys/types.h>

static void clamp(int resource, struct rlimit *want) {
    if (resource != RLIMIT_NOFILE || want == 0) return;
    struct rlimit cur;
    if (getrlimit(RLIMIT_NOFILE, &cur) != 0) return;
    if (want->rlim_max > cur.rlim_max) want->rlim_max = cur.rlim_max;
    if (want->rlim_cur > want->rlim_max) want->rlim_cur = want->rlim_max;
}

int setrlimit(__rlimit_resource_t resource, const struct rlimit *rlim) {
    static int (*real)(__rlimit_resource_t, const struct rlimit *);
    if (!real) real = dlsym(RTLD_NEXT, "setrlimit");
    struct rlimit r = *rlim;
    clamp(resource, &r);
    return real(resource, &r);
}

int setrlimit64(__rlimit_resource_t resource, const struct rlimit64 *rlim) {
    static int (*real)(__rlimit_resource_t, const struct rlimit64 *);
    if (!real) real = dlsym(RTLD_NEXT, "setrlimit64");
    struct rlimit64 r = *rlim;
    struct rlimit tmp = { (rlim_t)r.rlim_cur, (rlim_t)r.rlim_max };
    clamp(resource, &tmp);
    r.rlim_cur = tmp.rlim_cur; r.rlim_max = tmp.rlim_max;
    return real(resource, &r);
}

int prlimit(pid_t pid, __rlimit_resource_t resource, const struct rlimit *new_limit, struct rlimit *old_limit) {
    static int (*real)(pid_t, __rlimit_resource_t, const struct rlimit *, struct rlimit *);
    if (!real) real = dlsym(RTLD_NEXT, "prlimit");
    if (!new_limit) return real(pid, resource, new_limit, old_limit);
    struct rlimit r = *new_limit;
    clamp(resource, &r);
    return real(pid, resource, &r, old_limit);
}

int prlimit64(pid_t pid, __rlimit_resource_t resource, const struct rlimit64 *new_limit, struct rlimit64 *old_limit) {
    static int (*real)(pid_t, __rlimit_resource_t, const struct rlimit64 *, struct rlimit64 *);
    if (!real) real = dlsym(RTLD_NEXT, "prlimit64");
    if (!new_limit) return real(pid, resource, new_limit, old_limit);
    struct rlimit64 r = *new_limit;
    struct rlimit tmp = { (rlim_t)r.rlim_cur, (rlim_t)r.rlim_max };
    clamp(resource, &tmp);
    r.rlim_cur = tmp.rlim_cur; r.rlim_max = tmp.rlim_max;
    return real(pid, resource, &r, old_limit);
}
