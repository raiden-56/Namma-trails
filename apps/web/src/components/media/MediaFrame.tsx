import Image from "next/image";
import { cn } from "@/lib/cn";
import { photo, type PhotoKey } from "@/content/photos";
import { PlaceholderScene, type SceneName } from "./PlaceholderScene";

export interface MediaFrameProps {
  /** Image path or storage URL. When absent, the licensed photo for `scene` is used. */
  src?: string | null;
  alt: string;
  /** Mood of the slot; picks a licensed fallback photo when no `src` is given. */
  scene?: SceneName;
  /** Tailwind aspect class, e.g. "aspect-[4/5]". Omit when the parent sizes the frame. */
  aspect?: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
  /** Classes for the inner media layer (used for hover zoom / parallax scale). */
  mediaClassName?: string;
  /** Show the "Photo placeholder" caption when the illustrated fallback is used. */
  showPlaceholderNote?: boolean;
}

/** Licensed photo per scene, used wherever a slot has no specific image (credits on /photo-credits). */
const SCENE_PHOTO: Record<SceneName, PhotoKey> = {
  coast: "karwar-beach",
  backwater: "karwar-kali-river",
  hills: "yana-rocks",
  temple: "gokarna-koti-teertha",
  road: "nh66-kapu",
  forest: "mirjan-fort",
};

/**
 * Every image slot goes through MediaFrame: a specific `src`, else the licensed
 * photo for the scene. The illustrated scene remains only as a last resort.
 */
export function MediaFrame({
  src,
  alt,
  scene = "coast",
  aspect,
  priority,
  sizes = "(min-width: 1024px) 50vw, 100vw",
  className,
  mediaClassName,
  showPlaceholderNote = true,
}: MediaFrameProps) {
  const resolved = src ?? photo(SCENE_PHOTO[scene])?.src ?? null;
  return (
    <div className={cn("relative overflow-hidden bg-sand", aspect, className)}>
      {resolved ? (
        <Image src={resolved} alt={alt} fill priority={priority} sizes={sizes} className={cn("object-cover", mediaClassName)} />
      ) : (
        <div role="img" aria-label={`Photo placeholder — ${alt}`} className={cn("absolute inset-0 grain", mediaClassName)}>
          <PlaceholderScene scene={scene} />
          {showPlaceholderNote ? (
            <span className="absolute bottom-2 left-2 z-10 rounded-full bg-ink/55 px-2 py-0.5 text-[0.6875rem] font-medium text-cream backdrop-blur-sm">
              Photo placeholder
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
