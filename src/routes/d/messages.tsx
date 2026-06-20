import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMembership } from "@/hooks/useMembership";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Send, ArrowLeft, Check, CheckCheck } from "lucide-react";
import { formatDayLabel, formatTime, MessageStatus } from "@/lib/message-utils";

export const Route = createFileRoute("/d/messages")({ component: DriverMessages });

function DriverMessages() {
  const { user } = useAuth();
  const { data: m } = useMembership();
  const cid = m?.profile?.company_id;
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Find a manager to message (first fleet_admin/dispatcher in company)
  const { data: manager } = useQuery({
    queryKey: ["driver-manager", cid],
    enabled: !!cid,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("user_id, profiles:user_id(full_name,email)")
        .eq("company_id", cid!)
        .in("role", ["fleet_admin", "dispatcher"])
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: thread } = useQuery({
    queryKey: ["driver-thread", user?.id, manager?.user_id],
    enabled: !!user && !!manager?.user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(`and(from_user_id.eq.${user!.id},to_user_id.eq.${manager!.user_id}),and(from_user_id.eq.${manager!.user_id},to_user_id.eq.${user!.id})`)
        .order("created_at");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!cid) return;
    const ch = supabase
      .channel(`msg-driver-${cid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `company_id=eq.${cid}` }, () => {
        qc.invalidateQueries({ queryKey: ["driver-thread"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cid, qc]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [thread]);

  // Mark incoming messages as read
  useEffect(() => {
    if (!user || !thread) return;
    const unreadIds = thread.filter((msg: any) => msg.to_user_id === user.id && !msg.read_at).map((msg: any) => msg.id);
    if (unreadIds.length === 0) return;
    supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", unreadIds).then(() => {});
  }, [thread, user]);

  async function send() {
    if (!text.trim() || !user || !cid || !manager?.user_id) return;
    const body = text.trim();
    setText("");
    const { error } = await supabase.from("messages").insert({
      company_id: cid, from_user_id: user.id, to_user_id: manager.user_id, body,
    });
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["driver-thread"] });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Link to="/d" className="text-muted-foreground"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <div className="text-sm font-semibold">Dispatch</div>
          <div className="text-xs text-muted-foreground">{(manager as any)?.profiles?.full_name ?? (manager as any)?.profiles?.email ?? "—"}</div>
        </div>
      </header>
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {!manager && <div className="text-center text-sm text-muted-foreground">No dispatcher available.</div>}
        {thread?.length === 0 && <div className="text-center text-sm text-muted-foreground">Say hi to your dispatcher.</div>}
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
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
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
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message dispatch…" autoFocus />
        <Button type="submit" size="icon" disabled={!manager}><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}
