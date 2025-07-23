import React, { useEffect, useRef, useState, useCallback } from "react";
import { Protocol } from "pmtiles";
// MapLibre GL JS types
// @ts-ignore
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getCurrentPosition } from "@tauri-apps/plugin-geolocation";

let protocol = new Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

// --- Data Fetching Functions (Unchanged) ---
async function fetchMapStyle(): Promise<any> {
  const response = await fetch("/mapstyles.json");
  if (!response.ok) throw new Error("Failed to load mapstyles.json");
  const style = await response.json();
  if (style.sources?.protomaps) {
    style.sources.protomaps.url = "pmtiles://hong-kong.pmtiles";
  }
  return style;
}
async function fetchMtrRoutes(): Promise<any> {
  const response = await fetch("/datasets/mtr_routes.geojson");
  if (!response.ok) throw new Error("Failed to load mtr_routes.geojson");
  return await response.json();
}
async function fetchMtrStations(): Promise<any> {
  const response = await fetch("/datasets/mtr_stations_unique.geojson");
  if (!response.ok)
    throw new Error("Failed to load mtr_stations_unique.geojson");
  return await response.json();
}
async function fetchMtrInterchangeStations(): Promise<any> {
  const response = await fetch("/datasets/mtr_stations_interchange.geojson");
  if (!response.ok)
    throw new Error("Failed to load mtr_stations_interchange.geojson");
  return await response.json();
}

const MapPage: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const centerMarkerRef = useRef<maplibregl.Marker | null>(null);
  const isProgrammaticMove = useRef(false);
  const watchIdRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null,
  );
  const [selectedLocation, setSelectedLocation] = useState<
    [number, number] | null
  >(null);
  const [isFollowMode, setIsFollowMode] = useState(true);

  const latestStateRef = useRef({
    follow: isFollowMode,
    location: userLocation,
  });
  useEffect(() => {
    latestStateRef.current = {
      follow: isFollowMode,
      location: userLocation,
    };
  }, [isFollowMode, userLocation]);

  const calculateDistance = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180,
      φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const createCenterMarkerElement = (isSnapped: boolean): HTMLDivElement => {
    const el = document.createElement("div");
    el.style.cssText = "width: 24px; height: 24px; pointer-events: none;";
    if (isSnapped) {
      el.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="rgba(33, 150, 243, 0.3)" stroke="#2196f3" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="#2196f3"/><text x="12" y="8" text-anchor="middle" font-size="8" fill="#2196f3">📍</text></svg>`;
    } else {
      el.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="rgba(255, 0, 0, 0.3)" stroke="#ff0000" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="#ff0000"/></svg>`;
    }
    return el;
  };

  const updateCenterDisplay = useCallback(() => {
    if (!mapRef.current) return;
    const center = mapRef.current.getCenter();
    const { follow, location } = latestStateRef.current;

    const isSnapped = follow && location;
    const finalLng = isSnapped ? location![0] : center.lng;
    const finalLat = isSnapped ? location![1] : center.lat;

    setSelectedLocation([finalLng, finalLat]);

    if (!centerMarkerRef.current) {
      centerMarkerRef.current = new maplibregl.Marker({
        element: createCenterMarkerElement(isSnapped),
        anchor: "center",
      })
        .setLngLat([finalLng, finalLat])
        .addTo(mapRef.current);
    } else {
      centerMarkerRef.current.setLngLat([finalLng, finalLat]);
      (centerMarkerRef.current.getElement() as HTMLDivElement).innerHTML =
        createCenterMarkerElement(isSnapped).innerHTML;
    }
  }, []);

  useEffect(() => {
    if (isFollowMode && userLocation && mapRef.current) {
      isProgrammaticMove.current = true;
      mapRef.current.flyTo({ center: userLocation, zoom: 16, essential: true });
    }
    updateCenterDisplay();
  }, [isFollowMode, userLocation, updateCenterDisplay]);

  useEffect(() => {
    let isMounted = true;
    if (!mapContainer.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: { version: 8, sources: {}, layers: [] },
      center: [114.1694, 22.3193],
      zoom: 12,
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
    });
    map.touchPitch.disable();
    mapRef.current = map;

    // --- MAP EVENT LISTENERS ---
    map.on("movestart", () => {
      if (isProgrammaticMove.current) return;
      if (latestStateRef.current.follow) {
        setIsFollowMode(false);
      }
    });

    map.on("moveend", () => {
      if (isProgrammaticMove.current) {
        isProgrammaticMove.current = false;
        return;
      }

      updateCenterDisplay();

      const currentUserLocation = latestStateRef.current.location;
      if (currentUserLocation && mapRef.current) {
        const center = mapRef.current.getCenter();
        const distance = calculateDistance(
          center.lat,
          center.lng,
          currentUserLocation[1],
          currentUserLocation[0],
        );
        if (distance <= 20) {
          setIsFollowMode(true);
        }
      }
    });

    // --- NEW ---
    // Intercept the mouse wheel scroll to control zooming in follow mode.
    map.on("wheel", (e) => {
      // Only override behavior if in follow mode.
      if (latestStateRef.current.follow) {
        // Prevent the default scroll-zoom behavior.
        e.preventDefault();

        const currentUserLocation = latestStateRef.current.location;
        if (!currentUserLocation || !mapRef.current) return;

        // Calculate the new zoom level.
        // e.originalEvent.deltaY is negative for scrolling up (zoom in)
        // and positive for scrolling down (zoom out).
        const currentZoom = mapRef.current.getZoom();
        const newZoom = currentZoom - e.originalEvent.deltaY / 100; // Adjust sensitivity with the divisor.

        // Set the flag to prevent movestart from disabling follow mode.
        isProgrammaticMove.current = true;

        // Use easeTo for a smooth, centered zoom.
        mapRef.current.easeTo({
          center: currentUserLocation,
          zoom: newZoom,
          duration: 200, // A short duration feels responsive.
        });
      }
    });

    // --- DATA FETCHING AND LAYER SETUP ---
    const initializeMap = async () => {
      try {
        const [style, mtrRoutes, mtrStations, mtrInterchangeStations] =
          await Promise.all([
            fetchMapStyle(),
            fetchMtrRoutes(),
            fetchMtrStations(),
            fetchMtrInterchangeStations(),
          ]);
        if (!isMounted || !mapRef.current) return;
        map.setStyle(style);
        map.once("styledata", () => {
          map.addSource("mtr-routes", { type: "geojson", data: mtrRoutes });
          map.addSource("mtr-stations", { type: "geojson", data: mtrStations });
          map.addSource("mtr-interchange-stations", {
            type: "geojson",
            data: mtrInterchangeStations,
          });
          // ... add all layers ...
          const lineColorMap: Record<string, string> = {};
          mtrRoutes.features.forEach((f: any) => {
            if (f.properties?.line_name && f.properties?.color) {
              lineColorMap[f.properties.line_name] = f.properties.color;
            }
          });
          const stationColorExpression = [
            "match",
            ["coalesce", ["at", 0, ["get", "lines"]], ["get", "lines"]],
            ...Object.entries(lineColorMap).flat(),
            "#808080",
          ];
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
                  6,
                  14,
                  8,
                  24,
                  40,
                ],
                "line-color": "#fff",
                "line-opacity": 0.8,
              },
              layout: { "line-cap": "round", "line-join": "round" },
            },
            "address_label",
          );
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
              layout: { "line-cap": "round", "line-join": "round" },
            },
            "address_label",
          );
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
                  2.52,
                  13,
                  5.04,
                  16,
                  10.08,
                  22,
                  5.6,
                ],
                "circle-color": stationColorExpression as any,
              },
            },
            "address_label",
          );
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
                  14.4,
                  22,
                  8,
                ],
                "circle-color": "#000",
              },
            },
            "address_label",
          );
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
                  1.26,
                  13,
                  2.52,
                  16,
                  5.04,
                  22,
                  2.8,
                ],
                "circle-color": "#fff",
              },
            },
            "address_label",
          );
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
                  2.16,
                  13,
                  4.32,
                  16,
                  8.64,
                  22,
                  4.8,
                ],
                "circle-color": "#fff",
              },
            },
            "address_label",
          );
        });
      } catch (err: any) {
        if (isMounted) setError(err.message);
      }
    };
    initializeMap();

    // --- USER LOCATION SETUP ---
    const setupUserLocation = (lng: number, lat: number) => {
      if (!isMounted || !mapRef.current) return;
      const el = document.createElement("div");
      el.style.cssText =
        "width: 22px; height: 22px; border: 2px solid #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #FFFFFF; box-shadow: 0 0 10px rgba(0,0,0,0.5); pointer-events: none;";
      const blueDot = document.createElement("div");
      blueDot.style.cssText =
        "width: 16px; height: 16px; background: #2196f3; border-radius: 50%; animation: breathing-dot 2.8s ease-in-out infinite normal;";
      el.appendChild(blueDot);
      if (!document.getElementById("breathing-dot-style")) {
        const style = document.createElement("style");
        style.id = "breathing-dot-style";
        style.innerHTML = `@keyframes breathing-dot { 0% { transform: scale(1); } 40% { transform: scale(1.18); } 58% { transform: scale(1.18); } 100% { transform: scale(1); } }`;
        document.head.appendChild(style);
      }
      userMarkerRef.current = new maplibregl.Marker({
        element: el,
        anchor: "center",
      })
        .setLngLat([lng, lat])
        .addTo(mapRef.current);
      setUserLocation([lng, lat]);
    };

    if (/android|iphone|ipad|ipod/i.test(navigator.userAgent)) {
      getCurrentPosition()
        .then((pos) => {
          if (!isMounted) return;
          setupUserLocation(pos.coords.longitude, pos.coords.latitude);
          watchIdRef.current = navigator.geolocation.watchPosition(
            (p) => {
              const newPos: [number, number] = [
                p.coords.longitude,
                p.coords.latitude,
              ];
              setUserLocation(newPos);
              userMarkerRef.current?.setLngLat(newPos);
            },
            (e) => console.error("Error watching position:", e),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 },
          );
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    } else {
      setupUserLocation(114.169525, 22.321566); // Mock for desktop
      setLoading(false);
    }

    return () => {
      isMounted = false;
      if (watchIdRef.current !== null)
        navigator.geolocation.clearWatch(watchIdRef.current);
      mapRef.current?.remove();
    };
  }, [updateCenterDisplay]); // Added updateCenterDisplay here to satisfy exhaustive-deps

  // --- JSX (Unchanged) ---
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
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.8)",
            zIndex: 101,
          }}
        >
          {" "}
          Loading map...{" "}
        </div>
      )}
      {error && (
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,0,0,0.2)",
            color: "red",
            zIndex: 102,
          }}
        >
          {" "}
          Error loading map: {error}{" "}
        </div>
      )}

      {selectedLocation && (
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "20px",
            background: "rgba(255, 255, 255, 0.9)",
            padding: "10px 15px",
            borderRadius: "8px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
            zIndex: 103,
            fontSize: "14px",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
            {" "}
            {isFollowMode ? "📍 Current Location" : "📌 Selected Location"}{" "}
          </div>
          <div style={{ fontSize: "12px", color: "#666" }}>
            {" "}
            {selectedLocation[1].toFixed(6)},{" "}
            {selectedLocation[0].toFixed(6)}{" "}
          </div>
          {isFollowMode && (
            <div
              style={{ fontSize: "11px", color: "#2196f3", marginTop: "3px" }}
            >
              {" "}
              Following your location{" "}
            </div>
          )}
        </div>
      )}

      {userLocation && (
        <button
          onClick={() => setIsFollowMode((prev) => !prev)}
          style={{
            position: "absolute",
            bottom: "80px",
            right: "20px",
            width: "50px",
            height: "50px",
            borderRadius: "25px",
            border: "none",
            background: isFollowMode ? "#2196f3" : "rgba(255, 255, 255, 0.9)",
            color: isFollowMode ? "white" : "#333",
            boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
            cursor: "pointer",
            fontSize: "20px",
            zIndex: 103,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title={isFollowMode ? "Stop following" : "Follow my location"}
        >
          {isFollowMode ? "📍" : "🎯"}
        </button>
      )}

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          zIndex: 104,
        }}
      >
        <svg width="40" height="40" viewBox="0 0 40 40">
          <line
            x1="20"
            y1="5"
            x2="20"
            y2="15"
            stroke="#333"
            strokeWidth="2"
            opacity="0.7"
          />
          <line
            x1="20"
            y1="25"
            x2="20"
            y2="35"
            stroke="#333"
            strokeWidth="2"
            opacity="0.7"
          />
          <line
            x1="5"
            y1="20"
            x2="15"
            y2="20"
            stroke="#333"
            strokeWidth="2"
            opacity="0.7"
          />
          <line
            x1="25"
            y1="20"
            x2="35"
            y2="20"
            stroke="#333"
            strokeWidth="2"
            opacity="0.7"
          />
          <circle
            cx="20"
            cy="20"
            r="3"
            fill="none"
            stroke="#333"
            strokeWidth="2"
            opacity="0.7"
          />
        </svg>
      </div>

      <div
        ref={mapContainer}
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      />
    </div>
  );
};

export default MapPage;
