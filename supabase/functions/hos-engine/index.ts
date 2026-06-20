// FMCSA 49 CFR Part 395 HOS engine (US 70/8 property-carrying).
// Computes remaining drive/shift/cycle time and surfaces violations from
// the immutable hos_logs event stream.
//
// POST { driver_id: uuid, as_of?: ISO date }
// → { driver_id, as_of, drive_remaining_s, shift_remaining_s, cycle_remaining_s, break_remaining_s, violations: [...] }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const HOURS = (h: number) => h * 3600;

interface LogRow {
  id: string;
  driver_id: string;
  event_time: string;
  duty_status: "off_duty" | "sleeper_berth" | "driving" | "on_duty_not_driving" | "yard_move" | "personal_conveyance";
}

interface Violation {
  rule: string;
  cfr: string;
  detail: string;
  at: string;
}

function isOnDuty(s: LogRow["duty_status"]) {
  // Driving, On Duty Not Driving, and Yard Move count toward shift/cycle.
  return s === "driving" || s === "on_duty_not_driving" || s === "yard_move";
}

function compute(events: LogRow[], asOf: Date) {
  const sorted = [...events].sort((a, b) => +new Date(a.event_time) - +new Date(b.event_time));
  const violations: Violation[] = [];

  // 1) 30-minute break rule (§395.3(a)(3)(ii)): no driving beyond 8 cumulative
  //    hours of driving without an interruption of ≥ 30 consecutive minutes
  //    in any non-driving status.
  let drivingSinceBreak = 0;
  let lastNonDrivingStart: Date | null = null;
  // 2) 11-hour driving limit
  let drivingThisShift = 0;
  // 3) 14-hour shift limit (from first on-duty after 10 consecutive off)
  let shiftStart: Date | null = null;
  let shiftElapsed = 0;
  // 4) 70/8 cycle
  let cycleOnDuty = 0;
  const cycleWindowStart = new Date(asOf.getTime() - 8 * 24 * 3600 * 1000);

  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    const next = sorted[i + 1];
    const t1 = new Date(e.event_time);
    const t2 = next ? new Date(next.event_time) : asOf;
    const dur = Math.max(0, (t2.getTime() - t1.getTime()) / 1000);

    // Shift reset: 10+ consecutive hours off (off_duty or sleeper_berth)
    if ((e.duty_status === "off_duty" || e.duty_status === "sleeper_berth") && dur >= HOURS(10)) {
      shiftStart = null;
      drivingThisShift = 0;
      shiftElapsed = 0;
      drivingSinceBreak = 0;
      lastNonDrivingStart = null;
    }

    // Shift start: first on-duty after a reset
    if (isOnDuty(e.duty_status) && !shiftStart) {
      shiftStart = t1;
      shiftElapsed = 0;
    }

    // Track shift elapsed (any time after shift_start, regardless of status, except 10h reset above)
    if (shiftStart) {
      shiftElapsed += dur;
      if (shiftElapsed > HOURS(14)) {
        violations.push({
          rule: "14-hour shift limit",
          cfr: "49 CFR §395.3(a)(2)",
          detail: "Driving after the 14th hour following coming on duty",
          at: t1.toISOString(),
        });
      }
    }

    // Driving accumulators
    if (e.duty_status === "driving") {
      drivingThisShift += dur;
      drivingSinceBreak += dur;
      lastNonDrivingStart = null;

      if (drivingThisShift > HOURS(11)) {
        violations.push({
          rule: "11-hour driving limit",
          cfr: "49 CFR §395.3(a)(3)(i)",
          detail: "Drove more than 11 hours after 10 consecutive hours off duty",
          at: t1.toISOString(),
        });
      }
      if (drivingSinceBreak > HOURS(8)) {
        violations.push({
          rule: "30-minute break required",
          cfr: "49 CFR §395.3(a)(3)(ii)",
          detail: "More than 8 cumulative driving hours without a 30-minute interruption",
          at: t1.toISOString(),
        });
      }
    } else {
      // Non-driving: any ≥30 consecutive minutes resets the break counter
      if (dur >= 30 * 60) drivingSinceBreak = 0;
      lastNonDrivingStart = t1;
    }

    // Cycle on-duty inside the 8-day rolling window
    if (isOnDuty(e.duty_status)) {
      const overlapStart = Math.max(t1.getTime(), cycleWindowStart.getTime());
      const overlapEnd = Math.max(overlapStart, t2.getTime());
      cycleOnDuty += (overlapEnd - overlapStart) / 1000;
    }
  }

  if (cycleOnDuty > HOURS(70)) {
    violations.push({
      rule: "70-hour / 8-day cycle limit",
      cfr: "49 CFR §395.3(b)(2)",
      detail: "On-duty time exceeded 70 hours in any 8 consecutive days",
      at: asOf.toISOString(),
    });
  }

  return {
    drive_remaining_s: Math.max(0, HOURS(11) - drivingThisShift),
    shift_remaining_s: shiftStart ? Math.max(0, HOURS(14) - shiftElapsed) : HOURS(14),
    cycle_remaining_s: Math.max(0, HOURS(70) - cycleOnDuty),
    break_remaining_s: Math.max(0, HOURS(8) - drivingSinceBreak),
    violations,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { driver_id, as_of } = await req.json().catch(() => ({}));
    if (!driver_id || typeof driver_id !== "string") {
      return new Response(JSON.stringify({ error: "driver_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    const asOf = as_of ? new Date(as_of) : new Date();
    const windowStart = new Date(asOf.getTime() - 8 * 24 * 3600 * 1000);

    const { data: events, error } = await supabase
      .from("hos_logs")
      .select("id,driver_id,event_time,duty_status")
      .eq("driver_id", driver_id)
      .gte("event_time", windowStart.toISOString())
      .order("event_time");

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = compute((events ?? []) as LogRow[], asOf);
    return new Response(JSON.stringify({ driver_id, as_of: asOf.toISOString(), ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
