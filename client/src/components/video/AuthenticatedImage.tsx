import React, { useEffect, useState } from "react";
import { getToken } from "../../api";

export function AuthenticatedImage({
  src,
  alt,
  className
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [blobUrl, setBlobUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setFailed(false);
    setBlobUrl("");
    if (!src) {
      setFailed(true);
      return;
    }
    const token = getToken();
    fetch(src, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      .then((response) => {
        if (!response.ok) throw new Error(`Image request failed (${response.status})`);
        return response.blob();
      })
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (failed) {
    return (
      <div className={`${className ?? ""} flex items-center justify-center bg-slate-100 text-[11px] text-slate-500`}>
        Private preview unavailable
      </div>
    );
  }
  if (!blobUrl) {
    return <div className={`${className ?? ""} animate-pulse bg-slate-100`} aria-label={`Loading ${alt}`} />;
  }
  return <img src={blobUrl} alt={alt} className={className} loading="lazy" />;
}
