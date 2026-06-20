import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMembership } from "@/hooks/useMembership";
import { useAuth } from "@/hooks/useAuth";
import { Send, Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { formatDayLabel, formatTime, MessageStatus } from "@/lib/message-utils";

export const Route = createFileRoute("/messages")({ component: MessagesPage });

function MessagesPage() {
  const { user } = useAuth();
  const { data: m } = useMembership();
  const cid = m?.profile?.company_id;
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: drivers } = useQuery({
    queryKey: ["msg-drivers", cid],
    enabled: !!cid,
    queryFn: async () => {
      const { data } = await supabase
        .from("drivers")
        .select("id, profiles:id(full_name,email)")
        .eq("company_id", cid!);
      return data ?? [];
    },
  });

  const { data: thread } = useQuery({
    queryKey: ["msg-thread", user?.id, selected],
    enabled: !!user && !!selected,
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(`and(from_user_id.eq.${user!.id},to_user_id.eq.${selected}),and(from_user_id.eq.${selected},to_user_id.eq.${user!.id})`)
        .order("created_at");
      return data ?? [];
    },
  });

  // Unread counts per driver
  const { data: unread } = useQuery({
    queryKey: ["msg-unread", user?.id, cid],
    enabled: !!user && !!cid,
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("from_user_id")
        .eq("to_user_id", user!.id)
        .is("read_at", null);
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: any) => { counts[r.from_user_id] = (counts[r.from_user_id] ?? 0) + 1; });
      return counts;
    },
  });

  useEffect(() => {
    if (!cid) return;
    const ch = supabase
      .channel(`msg-fleet-${cid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `company_id=eq.${cid}` }, () => {
        qc.invalidateQueries({ queryKey: ["msg-thread"] });
        qc.invalidateQueries({ queryKey: ["msg-unread"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cid, qc]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [thread]);

  // Mark incoming messages as read when thread opens or updates
  useEffect(() => {
    if (!user || !selected || !thread) return;
    const unreadIds = thread.filter((msg: any) => msg.to_user_id === user.id && !msg.read_at).map((msg: any) => msg.id);
    if (unreadIds.length === 0) return;
    supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", unreadIds).then(() => {
      qc.invalidateQueries({ queryKey: ["msg-unread"] });
    });
  }, [thread, user, selected, qc]);

  async function send() {
    if (!text.trim() || !user || !cid || !selected) return;
    const body = text.trim();
    setText("");
    const { error } = await supabase.from("messages").insert({
      company_id: cid, from_user_id: user.id, to_user_id: selected, body,
    });
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["msg-thread"] });
  }

  const selectedDriver = useMemo(() => drivers?.find((d: any) => d.id === selected), [drivers, selected]);

  return (
    <AppShell>
      <PageHeader title="Messages" subtitle="Dispatcher ↔ Driver" />
      <div className="grid h-[calc(100vh-160px)] grid-cols-[280px_1fr] gap-4 p-6">
        <Card className="overflow-y-auto p-0">
          <div className="border-b border-border px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">Drivers</div>
          {(!drivers || drivers.length === 0) && <div className="p-6 text-sm text-muted-foreground">No drivers.</div>}
          {drivers?.map((d: any) => {
            const count = unread?.[d.id] ?? 0;
            return (
              <button key={d.id} onClick={() => setSelected(d.id)}
                className={`flex w-full items-center justify-between border-b border-border px-3 py-3 text-left text-sm hover:bg-accent ${selected === d.id ? "bg-accent" : ""}`}>
                <div className="min-w-0">
                  <div className="truncate font-medium">{d.profiles?.full_name ?? d.profiles?.email ?? "Driver"}</div>
                  <div className="truncate text-xs text-muted-foreground">{d.profiles?.email}</div>
                </div>
                {count > 0 && (
                  <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{count}</span>
                )}
              </button>
            );
          })}
        </Card>
        <Card className="flex flex-col p-0">
          {!selected ? (
            <div className="grid flex-1 place-items-center text-sm text-muted-foreground">Select a driver to start chatting</div>
          ) : (
            <>
              <div className="border-b border-border px-4 py-3 text-sm font-medium">
                {selectedDriver?.profiles?.full_name ?? selectedDriver?.profiles?.email}
              </div>
              <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
                {thread?.length === 0 && <div className="text-center text-sm text-muted-foreground">No messages yet.</div>}
                {thread?.map((msg: any, i: number) => {
                  const mine = msg.from_user_id === user?.id;
                  const prev = i > 0 ? thread[i - 1] : null;
                  const showDay = !prev || new Date(prev.created_at).toDateString() !== new Date(msg.created_at).toDateString();
                  return (
                    <div key={msg.id}>
                      {showDay && (
                        <div className="my-3 flex justify-center">
                          <span className="rounded-full bg-muted px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                            {formatDayLabel(msg.created_at)}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          <div className="whitespace-pre-wrap break-words">{msg.body}</div>
                          <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            <span>{formatTime(msg.created_at)}</span>
                            {mine && <MessageStatus readAt={msg.read_at} Check={Check} CheckCheck={CheckCheck} />}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <form className="flex gap-2 border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
                <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" autoFocus />
                <Button type="submit" size="icon"><Send className="h-4 w-4" /></Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
