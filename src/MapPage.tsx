import React, { useEffect, useRef, useState } from "react";
import { Protocol } from "pmtiles";
// MapLibre GL JS types
// @ts-ignore
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getCurrentPosition } from "@tauri-apps/plugin-geolocation";

let protocol = new Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

async function fetchMapStyle(): Promise<any> {
  const response = await fetch("/mapstyles.json");
  if (!response.ok) {
    throw new Error("Failed to load mapstyles.json");
  }
  const style = await response.json();

  if (style.sources && style.sources.protomaps) {
    style.sources.protomaps.url = "pmtiles://hong-kong.pmtiles";
  }

  return style;
}

async function fetchMtrRoutes(): Promise<any> {
  const response = await fetch("/datasets/mtr_routes.geojson");
  if (!response.ok) {
    throw new Error("Failed to load mtr_routes.geojson");
  }
  return await response.json();
}

async function fetchMtrStations(): Promise<any> {
  const response = await fetch("/datasets/mtr_stations_unique.geojson");
  if (!response.ok) {
    throw new Error("Failed to load mtr_stations_unique.geojson");
  }
  return await response.json();
}

async function fetchMtrInterchangeStations(): Promise<any> {
  const response = await fetch("/datasets/mtr_stations_interchange.geojson");
  if (!response.ok) {
    throw new Error("Failed to load mtr_stations_interchange.geojson");
  }
  return await response.json();
}

const MapPage: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const bearingMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to create a longer blue triangle marker for bearing
  function createBearingMarker(): HTMLDivElement {
    const el = document.createElement("div");
    el.style.width = "40px";
    el.style.height = "64px";
    el.style.position = "absolute";
    el.style.transform = "translate(-20px, -16px)";
    el.innerHTML = `
      <svg width="40" height="64" viewBox="0 0 40 64">
        <defs>
          <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#2196f3" stop-opacity="0.9"/>
            <stop offset="100%" stop-color="#2196f3" stop-opacity="0.2"/>
          </linearGradient>
        </defs>
        <polygon points="20,8 36,56 4,56" fill="url(#blueGradient)" />
      </svg>
    `;
    return el;
  }

  useEffect(() => {
    let isMounted = true;
    let map: maplibregl.Map | null = null;

    function isMobilePlatform() {
      const ua =
        navigator.userAgent || navigator.vendor || (window as any).opera;
      return /android|iphone|ipad|ipod/i.test(ua);
    }

    fetchMapStyle()
      .then((style) => {
        if (!isMounted || !mapContainer.current) return;

        map = new maplibregl.Map({
          container: mapContainer.current,
          style,
          center: [114.1694, 22.3193], // Hong Kong
          zoom: 12,
          attributionControl: false,
          pitchWithRotate: false,
          dragRotate: false,
        });
        map.touchPitch.disable();
        mapRef.current = map;

        map.on("load", async () => {
          try {
            // 1. LOAD MTR DATA
            const mtrRoutes = await fetchMtrRoutes();
            const mtrStations = await fetchMtrStations();
            const mtrInterchangeStations = await fetchMtrInterchangeStations();

            map.addSource("mtr-routes", {
              type: "geojson",
              data: mtrRoutes,
            });

            map.addSource("mtr-stations", {
              type: "geojson",
              data: mtrStations,
            });

            map.addSource("mtr-interchange-stations", {
              type: "geojson",
              data: mtrInterchangeStations,
            });

            // 2. BUILD COLOR MAP FOR STATIONS
            const lineColorMap: Record<string, string> = {};
            if (mtrRoutes && mtrRoutes.features) {
              for (const feature of mtrRoutes.features) {
                if (
                  feature.properties?.line_name &&
                  feature.properties?.color
                ) {
                  lineColorMap[feature.properties.line_name] =
                    feature.properties.color;
                }
              }
            }

            // 3. CREATE MAPLIBRE EXPRESSIONS & CONSTANTS

            const stationColorExpression = [
              "match",
              ["coalesce", ["at", 0, ["get", "lines"]], ["get", "lines"]],
              ...Object.entries(lineColorMap).flat(),
              "#808080", // Grey fallback color
            ];

            // NEW: Define a smaller scaling factor for interchange stations for easy adjustment.
            const interchangeScaleFactor = 1.2; // Was 1.4, now smaller.
            const factorbruh = 0.7;

            // 4. ADD MAP LAYERS (IN ORDER, FROM BOTTOM TO TOP)

            // LAYER 1: MTR Route Casing (the white outline)
            // UPDATED: Made casing thicker at high zoom levels.
            map.addLayer(
              {
                id: "mtr-routes-casing",
                type: "line",
                source: "mtr-routes",
                paint: {
                  "line-width": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    10,
                    6, // Main line (2) + 4px
                    14,
                    8, // Main line (4) + 4px
                    24,
                    40, // Main line (15) + 6px -> Thicker casing on zoom
                  ],
                  "line-color": "#fff",
                  "line-opacity": 0.8,
                },
                layout: {
                  "line-cap": "round",
                  "line-join": "round",
                },
              },
              "address_label",
            );

            // LAYER 2: MTR Route Line (the main colored line)
            map.addLayer(
              {
                id: "mtr-routes-line",
                type: "line",
                source: "mtr-routes",
                paint: {
                  "line-width": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    10,
                    2,
                    14,
                    4,
                    24,
                    15,
                  ],
                  "line-color": ["get", "color"],
                  "line-opacity": 1,
                },
                layout: {
                  "line-cap": "round",
                  "line-join": "round",
                },
              },
              "address_label",
            );

            // LAYER 3: MTR Station Outer Ring (shrinks on zoom)
            map.addLayer(
              {
                id: "mtr-stations-outer",
                type: "circle",
                source: "mtr-stations",
                paint: {
                  "circle-radius": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    10,
                    3.6 * factorbruh,
                    13,
                    7.2 * factorbruh,
                    16,
                    14.4 * factorbruh, // Peak size
                    22,
                    8 * factorbruh, // Shrinks at higher zooms
                  ],
                  "circle-color": stationColorExpression,
                },
              },
              "address_label",
            );

            // LAYER 3b: Interchange Station Outer Ring
            // UPDATED: Using the smaller interchangeScaleFactor.
            map.addLayer(
              {
                id: "mtr-interchange-stations-outer",
                type: "circle",
                source: "mtr-interchange-stations",
                paint: {
                  "circle-radius": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    10,
                    3.6,
                    13,
                    7.2,
                    16,
                    14.4, // Peak size
                    22,
                    8, // Shrinks
                  ],
                  "circle-color": "#000",
                },
              },
              "address_label",
            );

            // LAYER 4: MTR Station Inner Circle (shrinks on zoom)
            map.addLayer(
              {
                id: "mtr-stations-inner",
                type: "circle",
                source: "mtr-stations",
                paint: {
                  "circle-radius": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    10,
                    1.8 * factorbruh,
                    13,
                    3.6 * factorbruh,
                    16,
                    7.2 * factorbruh, // Peak size
                    22,
                    4 * factorbruh, // Shrinks
                  ],
                  "circle-color": "#fff",
                },
              },
              "address_label",
            );

            // LAYER 4b: Interchange Station Inner Circle
            // UPDATED: Using the smaller interchangeScaleFactor.
            map.addLayer(
              {
                id: "mtr-interchange-stations-inner",
                type: "circle",
                source: "mtr-interchange-stations",
                paint: {
                  "circle-radius": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    10,
                    1.8 * interchangeScaleFactor,
                    13,
                    3.6 * interchangeScaleFactor,
                    16,
                    7.2 * interchangeScaleFactor, // Peak size
                    22,
                    4 * interchangeScaleFactor, // Shrinks
                  ],
                  "circle-color": "#fff",
                },
              },
              "address_label",
            );
          } catch (error) {
            console.error("Error setting up MTR layers:", error);
          }
        });

        // --- USER LOCATION AND MARKER LOGIC (NO CHANGES) ---
        if (isMobilePlatform()) {
          getCurrentPosition()
            .then((pos) => {
              const lng = pos.coords.longitude;
              const lat = pos.coords.latitude;
              map?.flyTo({ center: [lng, lat], zoom: 16 });

              const el = document.createElement("div");
              el.style.width = "22px";
              el.style.height = "22px";
              el.style.border = "2px solid #fff";
              el.style.borderRadius = "50%";
              el.style.display = "flex";
              el.style.alignItems = "center";
              el.style.justifyContent = "center";
              el.style.background = "#FFFFFF";
              el.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
              el.style.pointerEvents = "none";

              const blueDot = document.createElement("div");
              blueDot.style.width = "16px";
              blueDot.style.height = "16px";
              blueDot.style.background = "#2196f3";
              blueDot.style.borderRadius = "50%";
              blueDot.style.animation =
                "breathing-dot 2.8s ease-in-out infinite normal";
              el.appendChild(blueDot);

              if (!document.getElementById("breathing-dot-style")) {
                const style = document.createElement("style");
                style.id = "breathing-dot-style";
                style.innerHTML = `
                  @keyframes breathing-dot {
                    0% { transform: scale(1); }
                    40% { transform: scale(1.18); }
                    58% { transform: scale(1.18); }
                    100% { transform: scale(1); }
                  }
                `;
                document.head.appendChild(style);
              }

              markerRef.current = new maplibregl.Marker({
                element: el,
                anchor: "center",
              })
                .setLngLat([lng, lat])
                .addTo(map!);
              setLoading(false);
            })
            .catch(() => {
              setLoading(false);
            });
        } else {
          // Emulate location for non-mobile
          const lng = 114.169525;
          const lat = 22.321566;
          map?.flyTo({ center: [lng, lat], zoom: 16 });

          const el = document.createElement("div");
          el.style.width = "22px";
          el.style.height = "22px";
          el.style.border = "2px solid #fff";
          el.style.borderRadius = "50%";
          el.style.display = "flex";
          el.style.alignItems = "center";
          el.style.justifyContent = "center";
          el.style.background = "#FFFFFF";
          el.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
          el.style.pointerEvents = "none";
          const blueDot = document.createElement("div");
          blueDot.style.width = "16px";
          blueDot.style.height = "16px";
          blueDot.style.background = "#2196f3";
          blueDot.style.borderRadius = "50%";
          blueDot.style.animation =
            "breathing-dot 2.8s ease-in-out infinite normal";
          el.appendChild(blueDot);

          if (!document.getElementById("breathing-dot-style")) {
            const style = document.createElement("style");
            style.id = "breathing-dot-style";
            style.innerHTML = `
                @keyframes breathing-dot {
                  0% { transform: scale(1); }
                  40% { transform: scale(1.18); }
                  58% { transform: scale(1.18); }
                  100% { transform: scale(1); }
                }
            `;
            document.head.appendChild(style);
          }

          markerRef.current = new maplibregl.Marker({
            element: el,
            anchor: "center",
          })
            .setLngLat([lng, lat])
            .addTo(map!);
          setLoading(false);
        }
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });

    function updateBearingMarker(bearing: number, lng: number, lat: number) {
      let marker = bearingMarkerRef.current;
      if (!marker) {
        const el = createBearingMarker();
        marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([lng, lat])
          .addTo(mapRef.current!);
        bearingMarkerRef.current = marker;
      }
      const el = marker.getElement();
      el.style.transform = `translate(-20px, -16px) rotate(${bearing}deg)`;
      marker.setLngLat([lng, lat]);
    }

    function handleOrientation(event: DeviceOrientationEvent) {
      const bearing = event.alpha ?? 0;
      if (markerRef.current) {
        const lngLat = markerRef.current.getLngLat();
        updateBearingMarker(bearing, lngLat.lng, lngLat.lat);
      }
    }

    if (window.DeviceOrientationEvent) {
      window.addEventListener("deviceorientation", handleOrientation, true);
    }

    return () => {
      isMounted = false;
      window.removeEventListener("deviceorientation", handleOrientation, true);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 100,
      }}
    >
      {loading && (
        <div
          style={{
            position: "absolute",
            width: "100vw",
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.8)",
            zIndex: 101,
          }}
        >
          Loading map...
        </div>
      )}
      {error && (
        <div
          style={{
            position: "absolute",
            width: "100vw",
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,0,0,0.2)",
            color: "red",
            zIndex: 102,
          }}
        >
          Error loading map: {error}
        </div>
      )}
      <div
        ref={mapContainer}
        style={{
          width: "100vw",
          height: "100vh",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      />
    </div>
  );
};

export default MapPage;
