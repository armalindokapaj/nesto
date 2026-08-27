"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { toActionError } from "@/lib/errors";

// PRD_BIM_3D_Digital_Twin — a real, working viewer, scoped down from the
// full PRD's IFC/geometry-conversion pipeline (that needs a parser this
// stack doesn't have, and the PRD itself leaves the format/rendering stack
// as an open decision) to glTF/GLB only — the standard web 3D interchange
// format, loadable directly via three.js with no server-side conversion
// step. Non-glTF source files (IFC, RVT, ...) still show the "no live
// preview" message; nothing is faked for those.
export function BimViewer({ fileUrl }: { fileUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x14161a);
    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.01, 5000);
    camera.position.set(3, 3, 3);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);
    scene.add(new THREE.GridHelper(20, 20, 0x333333, 0x222222));

    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const loader = new GLTFLoader();
    loader.load(
      fileUrl,
      (gltf) => {
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = box.getSize(new THREE.Vector3()).length() || 1;
        const center = box.getCenter(new THREE.Vector3());
        gltf.scene.position.sub(center);
        camera.position.set(size, size, size);
        controls.target.set(0, 0, 0);
        scene.add(gltf.scene);
        setLoading(false);
      },
      undefined,
      (err) => {
        setError(toActionError(err, "Could not load model file."));
        setLoading(false);
      }
    );

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [fileUrl]);

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-xl border border-border">
      <div ref={containerRef} className="h-full w-full" />
      {loading && !error && <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-faint bg-surface/60">Loading model…</p>}
      {error && <p className="absolute inset-0 flex items-center justify-center text-sm text-danger bg-surface/80 px-6 text-center">{error}</p>}
    </div>
  );
}
