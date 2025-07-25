import React, { useEffect, useRef, useState, useCallback } from "react";
import { FeatureCollection } from "geojson";
import { Protocol } from "pmtiles";
import { motion, useAnimationControls } from "motion/react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getCurrentPosition } from "@tauri-apps/plugin-geolocation";
import { selectionFeedback, impactFeedback } from "@tauri-apps/plugin-haptics";
import BottomBar from "./components/BottomBar"; // <--- IMPORT THE NEW COMPONENT

// Augment the Window interface to include __TAURI__
declare global {
  interface Window {
    __TAURI__?: object;
  }
}

let protocol = new Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

// Define interfaces for better type safety with fetched data

async function fetchMapStyle(): Promise<any> {
  const response = await fetch("/mapstyles.json");
  if (!response.ok) throw new Error("Failed to load mapstyles.json");
  const style = await response.json();
  if (style.sources?.protomaps) {
    style.sources.protomaps.url = "pmtiles://hong-kong.pmtiles";
  }
  return style;
}
async function fetchMtrRoutes(): Promise<FeatureCollection> {
  const response = await fetch("/datasets/mtr_routes.geojson");
  if (!response.ok) throw new Error("Failed to load mtr_routes.geojson");
  return await response.json();
}
async function fetchMtrStations(): Promise<FeatureCollection> {
  const response = await fetch("/datasets/mtr_stations_unique.geojson");
  if (!response.ok)
    throw new Error("Failed to load mtr_stations_unique.geojson");
  return await response.json();
}
async function fetchMtrInterchangeStations(): Promise<FeatureCollection> {
  const response = await fetch("/datasets/mtr_stations_interchange.geojson");
  if (!response.ok)
    throw new Error("Failed to load mtr_stations_interchange.geojson");
  return await response.json();
}

const MapPage: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const isProgrammaticMove = useRef(false);
  const watchIdRef = useRef<number | null>(null);
  //const isRequestAllowed = useRef(true);
  // Refs for custom pinch-to-zoom
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null,
  );
  const [selectedLocation, setSelectedLocation] = useState<
    [number, number] | null
  >(null);
  const [isFollowMode, setIsFollowMode] = useState(true);
  const [isMapMoving, setIsMapMoving] = useState(false);
  const [_, setIsGeocoding] = useState(false);
  const [addressZh, setAddressZh] = useState<string | null>(null);

  const markerAnimationControls = useAnimationControls();

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

  useEffect(() => {
    const positioning = { x: "-50%", y: "-100%" };

    if (isFollowMode) {
      markerAnimationControls.set({ ...positioning, scale: 0, opacity: 0 });
      return;
    }

    if (isMapMoving) {
      markerAnimationControls.set({
        ...positioning,
        scale: 0.24,
        opacity: 0.6,
      });
    } else {
      markerAnimationControls.set({ ...positioning, scale: 0.12, opacity: 1 });
      selectionFeedback();
      markerAnimationControls.start(
        { ...positioning, scale: 0.24 },
        { type: "spring", stiffness: 1000, damping: 15, mass: 0.5 },
      );
    }
  }, [isFollowMode, isMapMoving, markerAnimationControls]);

  function formatAddress(address: {
    amenity?: string;
    tourism?: string;
    building?: string;
    house_number?: string;
    road?: string;
    residential?: string;
    suburb?: string;
    city_district?: string;
    city?: string;
  }) {
    // Only include the fields you want, and skip the street number
    const parts = [
      address.amenity,
      address.tourism,
      address.building,
      address.road,
      address.house_number,
      address.residential,
      address.suburb,
      address.city_district,
      address.city,
    ].filter(Boolean); // Remove undefined/null
    return parts.join(" ");
  }

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

  const updateCenterDisplay = useCallback(() => {
    if (!mapRef.current) return;
    const center = mapRef.current.getCenter();
    const { follow, location } = latestStateRef.current;
    const isSnapped = Boolean(follow && location);
    const finalLng = isSnapped ? location![0] : center.lng;
    const finalLat = isSnapped ? location![1] : center.lat;
    setSelectedLocation([finalLng, finalLat]);
  }, []);

  const fetchAddress = useCallback(async (lng: number, lat: number) => {
    const userAgent = "WheelsClient/1.0 (policy@wheels.app)";
    setIsGeocoding(true);
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lon=${lng}&lat=${lat}&accept-language=zh-Hant`;
    try {
      const response = await fetch(nominatimUrl, {
        headers: { "User-Agent": userAgent },
      });
      if (response.ok) {
        const data = await response.json();
        setAddressZh(formatAddress(data.address) || "地址未找到。");
      } else {
        setAddressZh("無法獲取地址。");
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      setAddressZh("地理編碼失敗。");
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      fetchAddress(selectedLocation[0], selectedLocation[1]);
    }
  }, [selectedLocation, fetchAddress]);

  useEffect(() => {
    if (mapRef.current) {
      if (isFollowMode) {
        mapRef.current.touchZoomRotate.disable(); // Disable default zoom in follow mode
        if (userLocation) {
          isProgrammaticMove.current = true;
          mapRef.current.easeTo({ center: userLocation, duration: 500 });
        }
      } else {
        mapRef.current.touchZoomRotate.enable(); // Enable default zoom when not following
      }
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
      zoom: 16,
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
    });
    map.touchPitch.disable();
    mapRef.current = map;

    map.on("movestart", () => {
      if (isProgrammaticMove.current) return;
      setIsMapMoving(true);
    });
    map.on("moveend", () => {
      if (isProgrammaticMove.current) {
        isProgrammaticMove.current = false;
        return;
      }
      setIsMapMoving(false);
      updateCenterDisplay();
      const { follow, location } = latestStateRef.current;
      if (!follow && location) {
        const center = map.getCenter();
        const distance = calculateDistance(
          center.lat,
          center.lng,
          location[1],
          location[0],
        );
        if (distance <= 25) {
          impactFeedback("soft");
          setIsFollowMode(true);
        }
      }
    });

    map.on("dragstart", (e: maplibregl.MapTouchEvent) => {
      if (isProgrammaticMove.current) return;
      if (
        e.originalEvent &&
        "touches" in e.originalEvent &&
        e.originalEvent.touches.length > 1
      ) {
        return;
      }
      setIsFollowMode(false);
    });

    // Custom Touch Handlers for Pinch-to-Zoom in Follow Mode
    const getTouchDistance = (touches: TouchList): number => {
      const touch1 = touches[0];
      const touch2 = touches[1];
      return Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY,
      );
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (
        e.touches.length === 2 &&
        latestStateRef.current.follow &&
        mapRef.current
      ) {
        e.preventDefault();
        mapRef.current.dragPan.disable();
        pinchStartDistanceRef.current = getTouchDistance(e.touches);
        pinchStartZoomRef.current = mapRef.current.getZoom();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (
        e.touches.length === 2 &&
        pinchStartDistanceRef.current != null &&
        pinchStartZoomRef.current != null &&
        latestStateRef.current.follow &&
        mapRef.current
      ) {
        e.preventDefault();
        const currentDist = getTouchDistance(e.touches);
        const scale = currentDist / pinchStartDistanceRef.current;
        const newZoom = pinchStartZoomRef.current + Math.log2(scale);
        mapRef.current.setZoom(newZoom);
      }
    };

    const handleTouchEnd = () => {
      if (pinchStartDistanceRef.current != null) {
        pinchStartDistanceRef.current = null;
        pinchStartZoomRef.current = null;
        mapRef.current?.dragPan.enable();
      }
    };

    const container = mapContainer.current;
    container.addEventListener("touchstart", handleTouchStart);
    container.addEventListener("touchmove", handleTouchMove);
    container.addEventListener("touchend", handleTouchEnd);
    container.addEventListener("touchcancel", handleTouchEnd);

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
          if (!mapRef.current) return;
          map.addSource("mtr-routes", {
            type: "geojson",
            data: mtrRoutes as FeatureCollection,
          });
          map.addSource("mtr-stations", {
            type: "geojson",
            data: mtrStations as FeatureCollection,
          });
          map.addSource("mtr-interchange-stations", {
            type: "geojson",
            data: mtrInterchangeStations as FeatureCollection,
          });

          // This mapping logic is correct for the routes, but not needed for the stations.
          // We will leave it here as it doesn't harm anything and might be useful for other layers.
          const lineColorMap: Record<string, string> = {};
          mtrRoutes.features.forEach((f) => {
            if (f.properties?.line_name && f.properties?.color) {
              lineColorMap[f.properties.line_name] = f.properties.color;
            }
          });

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
                // --- FIX ---
                // Directly get the color from the feature's "color" property
                "circle-color": ["get", "color"],
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

    const getUserLocation = async (): Promise<[number, number]> => {
      if (window.__TAURI__) {
        try {
          const pos = await getCurrentPosition();
          return [pos.coords.longitude, pos.coords.latitude];
        } catch (e) {
          console.warn(
            "Could not get location via Tauri, falling back to browser API.",
            e,
          );
        }
      }
      return new Promise((resolve, reject) => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (p) => resolve([p.coords.longitude, p.coords.latitude]),
            (err) => reject(err),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 },
          );
        } else {
          reject(new Error("Geolocation not supported"));
        }
      });
    };

    getUserLocation()
      .then(([lng, lat]) => {
        if (!isMounted) return;
        setupUserLocation(lng, lat);
        if (navigator.geolocation && navigator.geolocation.watchPosition) {
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
        }
      })
      .catch(() => {
        if (isMounted) setupUserLocation(114.169525, 22.321566);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      if (watchIdRef.current !== null)
        navigator.geolocation.clearWatch(watchIdRef.current);
      // Clean up native event listeners
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
      mapRef.current?.remove();
    };
  }, []); // Empty dependency array ensures this runs only once on mount.

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 100,
        overflow: "hidden",
      }}
    >
      {/* --- Map and UI Elements --- */}
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
            zIndex: 201,
          }}
        >
          Loading map...
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
            zIndex: 202,
          }}
        >
          Error loading map: {error}
        </div>
      )}
      <motion.img
        src="/Markers/MainMarker.svg"
        alt="Map center marker"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          zIndex: 104,
          pointerEvents: "none",
          transformOrigin: "50% calc(100% + 1px)",
        }}
        animate={markerAnimationControls}
      />

      <BottomBar followMode={isFollowMode} addressZh={addressZh} />
    </div>
  );
};

export default MapPage;
