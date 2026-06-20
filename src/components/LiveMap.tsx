import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";

export interface MapVehicle {
  id: string;
  unit: string;
  lat: number;
  lng: number;
  status?: "driving" | "idle" | "offline";
}

export function LiveMap({ vehicles = [], height = 480 }: { vehicles?: MapVehicle[]; height?: number | string }) {
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<Record<string, maplibregl.Marker>>({});

  useEffect(() => {
    if (!ref.current || map.current) return;
    map.current = new maplibregl.Map({
      container: ref.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: [-96, 39],
      zoom: 3.6,
    });
    map.current.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    // Tint to fit dark theme
    if (ref.current) ref.current.style.filter = "invert(0.92) hue-rotate(180deg) brightness(0.95) contrast(0.95)";
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    const seen = new Set<string>();
    vehicles.forEach((v) => {
      seen.add(v.id);
      const color = v.status === "driving" ? "#27d97f" : v.status === "idle" ? "#f5b042" : "#9aa4b2";
      if (markers.current[v.id]) {
        markers.current[v.id].setLngLat([v.lng, v.lat]);
      } else {
        const el = document.createElement("div");
        el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${color};box-shadow:0 0 0 3px rgba(0,0,0,0.35),0 0 12px ${color}aa;border:2px solid white;`;
        const popup = new maplibregl.Popup({ offset: 12, closeButton: false }).setText(`Unit ${v.unit}`);
        markers.current[v.id] = new maplibregl.Marker({ element: el })
          .setLngLat([v.lng, v.lat])
          .setPopup(popup)
          .addTo(map.current!);
      }
    });
    // Remove stale
    Object.keys(markers.current).forEach((id) => {
      if (!seen.has(id)) {
        markers.current[id].remove();
        delete markers.current[id];
      }
    });
  }, [vehicles]);

  return <div ref={ref} style={{ width: "100%", height }} className="overflow-hidden rounded-lg border border-border" />;
}
