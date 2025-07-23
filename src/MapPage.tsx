import React, { useEffect, useRef, useState, useCallback } from "react";
import { Protocol } from "pmtiles";
import { motion, useAnimationControls } from "motion/react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getCurrentPosition } from "@tauri-apps/plugin-geolocation";

let protocol = new Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

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
  const isZooming = useRef(false);
  const isRequestAllowed = useRef(true);

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
  const [isGeocoding, setIsGeocoding] = useState(false);
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
      markerAnimationControls.set({ ...positioning, scale: 0.3, opacity: 0.6 });
    } else {
      markerAnimationControls.set({ ...positioning, scale: 0.2, opacity: 1 });
      markerAnimationControls.start(
        { ...positioning, scale: 0.3 },
        { type: "spring", stiffness: 600, damping: 15, mass: 0.5 },
      );
    }
  }, [isFollowMode, isMapMoving, markerAnimationControls]);

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
    const isSnapped = Boolean(follow && location);
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
        setAddressZh(data.display_name || "地址未找到。");
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
    if (selectedLocation && isRequestAllowed.current) {
      isRequestAllowed.current = false;
      fetchAddress(selectedLocation[0], selectedLocation[1]);
      setTimeout(() => {
        isRequestAllowed.current = true;
      }, 1000);
    }
  }, [selectedLocation, fetchAddress]);

  useEffect(() => {
    if (isFollowMode && userLocation && mapRef.current) {
      isProgrammaticMove.current = true;
      mapRef.current.easeTo({ center: userLocation, duration: 500 });
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

    map.on("movestart", () => {
      if (isProgrammaticMove.current) return;
      setIsMapMoving(true);
    });
    map.on("moveend", () => {
      setIsMapMoving(false);
      if (isProgrammaticMove.current) {
        isProgrammaticMove.current = false;
        return;
      }
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
        if (distance <= 20) {
          setIsFollowMode(true);
        }
      }
    });
    map.on("zoomstart", () => {
      isZooming.current = true;
    });
    map.on("zoomend", () => {
      isZooming.current = false;
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
    map.on("move", () => {
      const { follow, location } = latestStateRef.current;
      if (follow && isZooming.current && location) {
        map.setCenter(location);
      }
    });

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
      setupUserLocation(114.169525, 22.321566);
      setLoading(false);
    }

    return () => {
      isMounted = false;
      if (watchIdRef.current !== null)
        navigator.geolocation.clearWatch(watchIdRef.current);
      mapRef.current?.remove();
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
        overflow: "hidden",
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
            maxWidth: "350px",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
            {isFollowMode ? "📍 Current Location" : "📌 Selected Location"}
          </div>
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>
            {selectedLocation[1].toFixed(6)}, {selectedLocation[0].toFixed(6)}
          </div>
          <div style={{ borderTop: "1px solid #eee", paddingTop: "8px" }}>
            {isGeocoding ? (
              <div style={{ fontSize: "12px", color: "#666" }}>尋找地址...</div>
            ) : (
              <>
                {addressZh && (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#333",
                      lineHeight: "1.4",
                    }}
                  >
                    {addressZh}
                  </div>
                )}
              </>
            )}
          </div>
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

      <motion.img
        src="/Markers/MainMarker.svg"
        alt="Map center marker"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          zIndex: 104,
          pointerEvents: "none",
          transformOrigin: "50% calc(100% - 10px)",
        }}
        animate={markerAnimationControls}
      />

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
