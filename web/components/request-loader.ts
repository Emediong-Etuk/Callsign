"use client";
import { useCallback, useEffect, useState } from "react";
import type { FlagView, MemberView, RequestView } from "@/lib/near/types";

type Data = { request: RequestView; members: MemberView[]; flag: FlagView | null };
type Result = { data: Data | null; error: string | null };

const fetchRequest = (id: string): Promise<Result> =>
  fetch(`/api/vault/request/${id}`, { cache: "no-store" })
    .then(async (res) => {
      const json = await res.json();
      return res.ok
        ? { data: json as Data, error: null }
        : { data: null, error: (json.error as string) ?? "Request not found" };
    })
    .catch(() => ({ data: null, error: "Couldn't reach the server." }));

export function useRequest(id: string) {
  const [result, setResult] = useState<Result>({ data: null, error: null });
  const reload = useCallback(() => fetchRequest(id).then(setResult), [id]);
  useEffect(() => {
    let alive = true;
    const tick = () => fetchRequest(id).then((r) => alive && setResult(r));
    tick();
    const t = setInterval(tick, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id]);
  return { ...result, reload };
}
