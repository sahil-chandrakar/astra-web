"use client";

import React from "react";

/** A single shimmering skeleton text line. */
export function SkeletonText({ className = "" }: { className?: string }) {
  return <div className={`skeleton skeleton-text ${className}`} />;
}

/** A round skeleton avatar placeholder. */
export function SkeletonAvatar() {
  return <div className="skeleton skeleton-avatar" />;
}

/** A rectangular skeleton card placeholder. */
export function SkeletonCard() {
  return <div className="skeleton skeleton-card" />;
}

/** A small skeleton metric badge. */
export function SkeletonMetric() {
  return <div className="skeleton skeleton-metric" />;
}

/** Skeleton placeholder for a transcript row (avatar + two text lines). */
export function SkeletonTranscriptRow() {
  return (
    <div style={{ display: "flex", gap: 10, padding: "8px 0", alignItems: "start" }}>
      <SkeletonAvatar />
      <div style={{ flex: 1 }}>
        <SkeletonText className="medium" />
        <SkeletonText className="short" />
      </div>
    </div>
  );
}

/** Skeleton placeholder for a settings/agent card. */
export function SkeletonSettingsCard() {
  return (
    <div style={{ display: "grid", gap: 8, padding: 14 }}>
      <SkeletonText className="short" />
      <SkeletonText />
      <SkeletonText className="medium" />
    </div>
  );
}

/** Skeleton placeholder set, renders N skeleton cards. */
export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
