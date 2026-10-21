"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { arcPoints } from "@/lib/geo";
import type { MapPayload, MapStatusFilter } from "@/lib/map";
import type { Team } from "@/lib/types";

const TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

function ZoomWatcher({ onZoom }: { onZoom: (zoom: number) => void }) {
  useMapEvents({
    zoomend: (event) => onZoom(event.target.getZoom()),
  });
  return null;
}

function FlyTo({ team }: { team: Team | null }) {
  const map = useMap();
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!team) {
      last.current = null;
      return;
    }
    if (last.current === team.id) return;
    last.current = team.id;
    map.flyTo([team.arena.lat, team.arena.lon], Math.max(map.getZoom(), 6), { duration: 0.8 });
  }, [team, map]);
  return null;
}

function markerIcon(team: Team, size: number): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div class="team-marker" style="width:${size}px;height:${size}px;background:linear-gradient(145deg,${team.colors.primary},${team.colors.secondary})">${team.abbreviation}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function ClusterZoom({ signal }: { signal: number }) {
  const map = useMap();
  useEffect(() => {
    if (signal > 0) map.flyTo(map.getCenter(), 5, { duration: 0.6 });
  }, [signal, map]);
  return null;
}

export default function MapCanvas({
  payload,
  selectedTeamId,
  onSelect,
  showTiles,
  statusFilter,
}: {
  payload: MapPayload;
  selectedTeamId: string | null;
  onSelect: (teamId: string | null) => void;
  showTiles: boolean;
  statusFilter: MapStatusFilter;
}) {
  const [zoom, setZoom] = useState(4);
  const [clusterSignal, setClusterSignal] = useState(0);
  const initialZoom = typeof window !== "undefined" && window.innerWidth < 640 ? 3 : 4;

  const visibleTrips = useMemo(
    () =>
      payload.trips.filter((t) => {
        if (statusFilter === "all") return true;
        if (statusFilter === "active") return t.trip.status === "active";
        if (statusFilter === "upcoming") return t.trip.status === "upcoming";
        return t.trip.status === "completed";
      }),
    [payload.trips, statusFilter],
  );

  const selectedTeam = payload.teams.find((t) => t.team.id === selectedTeamId)?.team ?? null;
  const clustered = zoom < 3;

  const clusters = useMemo(() => {
    const east = payload.teams.filter((t) => t.team.conference === "East");
    const west = payload.teams.filter((t) => t.team.conference === "West");
    return [
      {
        key: "east",
        label: "East",
        count: east.length,
        lat: east.reduce((s, t) => s + t.team.arena.lat, 0) / Math.max(east.length, 1),
        lon: east.reduce((s, t) => s + t.team.arena.lon, 0) / Math.max(east.length, 1),
      },
      {
        key: "west",
        label: "West",
        count: west.length,
        lat: west.reduce((s, t) => s + t.team.arena.lat, 0) / Math.max(west.length, 1),
        lon: west.reduce((s, t) => s + t.team.arena.lon, 0) / Math.max(west.length, 1),
      },
    ];
  }, [payload.teams]);

  return (
    <MapContainer
      center={[38.5, -96]}
      zoom={initialZoom}
      minZoom={3}
      maxZoom={9}
      scrollWheelZoom
      className={showTiles ? "h-full w-full" : "h-full w-full grid-lines"}
      style={{ background: showTiles ? "#070b14" : "#05080f" }}
      attributionControl
    >
      {showTiles ? (
        <TileLayer
          url={TILE_URL}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          opacity={0.8}
        />
      ) : null}
      <ZoomWatcher onZoom={setZoom} />
      <ClusterZoom signal={clusterSignal} />
      <FlyTo team={selectedTeam} />

      {visibleTrips.map(({ teamId, trip }) => {
        const team = payload.teams.find((t) => t.team.id === teamId)?.team;
        if (!team) return null;
        const active = trip.status === "active";
        return trip.legs.map((leg, index) => (
          <Polyline
            key={`${trip.id}-${leg.id}-${index}`}
            positions={arcPoints(leg.from, leg.to, 24)}
            pathOptions={{
              color: team.colors.primary,
              weight: active ? 2.4 : 1.4,
              opacity: active ? 0.95 : 0.55,
              dashArray: active ? "6 8" : "2 7",
              className: active ? "route-anim" : undefined,
            }}
            eventHandlers={{ click: () => onSelect(team.id) }}
          >
            <Tooltip sticky>
              <span className="text-xs">
                {team.abbreviation} · {leg.from.city} → {leg.to.city}
                <br />
                {leg.miles.toLocaleString()} mi estimated
              </span>
            </Tooltip>
          </Polyline>
        ));
      })}

      {clustered
        ? clusters.map((cluster) => (
            <CircleMarker
              key={cluster.key}
              center={[cluster.lat, cluster.lon]}
              radius={26}
              pathOptions={{ color: "#52e5b0", fillColor: "#52e5b0", fillOpacity: 0.12, weight: 1 }}
              eventHandlers={{ click: () => setClusterSignal((n) => n + 1) }}
            >
              <Tooltip permanent direction="center" className="!bg-transparent !border-0 !shadow-none">
                <span className="text-xs font-bold text-mint-300">{cluster.count} {cluster.label}</span>
              </Tooltip>
            </CircleMarker>
          ))
        : payload.teams.map(({ team, metrics }) => (
            <Marker
              key={team.id}
              position={[team.arena.lat, team.arena.lon]}
              icon={markerIcon(team, selectedTeamId === team.id ? 34 : 26)}
              eventHandlers={{ click: () => onSelect(team.id) }}
              keyboard
              title={`${team.name} — fatigue ${metrics.fatigueIndex}`}
              alt={`${team.name} marker`}
            >
              <Tooltip direction="top" offset={[0, -14]} opacity={1}>
                <div className="min-w-[140px]">
                  <p className="text-xs font-bold text-mist-100">{team.name}</p>
                  <p className="text-[11px] text-mist-400">
                    {metrics.statusLabel} · fatigue {metrics.fatigueIndex}
                  </p>
                  <p className="text-[10px] text-mist-500">Click for itinerary</p>
                </div>
              </Tooltip>
            </Marker>
          ))}
    </MapContainer>
  );
}
