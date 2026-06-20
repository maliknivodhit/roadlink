import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, FileText, Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/d/trip")({ component: TripDocs });

type Form = {
  trip_date: string;
  start_location: string;
  destination: string;
  shipping_number: string;
  bol_number: string;
  trailer_number: string;
  load_description: string;
  notes: string;
};

const empty: Form = {
  trip_date: new Date().toISOString().slice(0, 10),
  start_location: "",
  destination: "",
  shipping_number: "",
  bol_number: "",
  trailer_number: "",
  load_description: "",
  notes: "",
};

function TripDocs() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<Form>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [loading, user, nav]);

  const { data: driver } = useQuery({
    queryKey: ["driver-self-trip", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("drivers")
        .select("id,company_id,current_vehicle_id").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: trips } = useQuery({
    queryKey: ["driver-trip-docs", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_documents")
        .select("*")
        .eq("driver_id", user!.id)
        .order("trip_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  function reset() { setForm(empty); setEditingId(null); }

  async function save() {
    if (!user || !driver?.company_id) return toast.error("No company");
    if (!form.start_location.trim() || !form.destination.trim())
      return toast.error("Start and destination are required");
    const payload = {
      company_id: driver.company_id,
      driver_id: user.id,
      vehicle_id: driver.current_vehicle_id ?? null,
      trip_date: form.trip_date,
      start_location: form.start_location.trim(),
      destination: form.destination.trim(),
      shipping_number: form.shipping_number.trim() || null,
      bol_number: form.bol_number.trim() || null,
      trailer_number: form.trailer_number.trim() || null,
      load_description: form.load_description.trim() || null,
      notes: form.notes.trim() || null,
    };
    const q = editingId
      ? supabase.from("trip_documents").update(payload).eq("id", editingId)
      : supabase.from("trip_documents").insert(payload);
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success(editingId ? "Trip updated" : "Trip saved");
    reset();
    qc.invalidateQueries({ queryKey: ["driver-trip-docs"] });
  }

  function edit(t: any) {
    setEditingId(t.id);
    setForm({
      trip_date: t.trip_date,
      start_location: t.start_location ?? "",
      destination: t.destination ?? "",
      shipping_number: t.shipping_number ?? "",
      bol_number: t.bol_number ?? "",
      trailer_number: t.trailer_number ?? "",
      load_description: t.load_description ?? "",
      notes: t.notes ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(id: string) {
    if (!confirm("Delete this trip document?")) return;
    const { error } = await supabase.from("trip_documents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["driver-trip-docs"] });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <Link to="/d" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4" /> Trip Docs</div>
        <div className="w-12" />
      </header>

      <div className="space-y-4 p-4">
        <Card className="space-y-3 p-4">
          <div className="text-sm font-semibold">{editingId ? "Edit trip" : "New trip"}</div>
          <div>
            <Label>Trip date</Label>
            <Input type="date" value={form.trip_date} onChange={(e) => setForm({ ...form, trip_date: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Start location *</Label>
              <Input placeholder="Dallas, TX" value={form.start_location} onChange={(e) => setForm({ ...form, start_location: e.target.value })} />
            </div>
            <div>
              <Label>Destination *</Label>
              <Input placeholder="Phoenix, AZ" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
            </div>
            <div>
              <Label>Shipping #</Label>
              <Input value={form.shipping_number} onChange={(e) => setForm({ ...form, shipping_number: e.target.value })} />
            </div>
            <div>
              <Label>BOL #</Label>
              <Input value={form.bol_number} onChange={(e) => setForm({ ...form, bol_number: e.target.value })} />
            </div>
            <div>
              <Label>Trailer #</Label>
              <Input value={form.trailer_number} onChange={(e) => setForm({ ...form, trailer_number: e.target.value })} />
            </div>
            <div>
              <Label>Load description</Label>
              <Input placeholder="Pallets of produce" value={form.load_description} onChange={(e) => setForm({ ...form, load_description: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button onClick={save} className="flex-1">
              <Plus className="mr-1 h-4 w-4" />{editingId ? "Update" : "Save trip"}
            </Button>
            {editingId && <Button variant="outline" onClick={reset}>Cancel</Button>}
          </div>
        </Card>

        <div>
          <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">RECENT TRIPS</div>
          <div className="space-y-2">
            {(!trips || trips.length === 0) && (
              <Card className="p-6 text-center text-sm text-muted-foreground">No trip documents yet</Card>
            )}
            {trips?.map((t: any) => (
              <Card key={t.id} className="p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{t.start_location} → {t.destination}</div>
                    <div className="text-xs text-muted-foreground">{new Date(t.trip_date).toLocaleDateString()}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {t.shipping_number && <span>Ship# {t.shipping_number}</span>}
                      {t.bol_number && <span>BOL {t.bol_number}</span>}
                      {t.trailer_number && <span>Trailer {t.trailer_number}</span>}
                    </div>
                    {t.load_description && <div className="mt-1 text-xs">{t.load_description}</div>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => edit(t)}><Pencil className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
