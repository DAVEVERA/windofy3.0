"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type SceneRefs = {
  bottomRail: THREE.Mesh;
  cordGroup: THREE.Group;
  frameGroup: THREE.Group;
  slats: THREE.Mesh[];
};

function woodTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#9f6f43");
  gradient.addColorStop(0.5, "#c18b57");
  gradient.addColorStop(1, "#7c5536");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < canvas.height; y += 3) {
    context.strokeStyle = `rgba(71, 42, 24, ${0.08 + (y % 11) / 120})`;
    context.beginPath();
    for (let x = 0; x < canvas.width; x += 16) {
      const wave = Math.sin((x + y * 3.1) / 28) * 3 + Math.sin(x / 61) * 5;
      if (x === 0) {
        context.moveTo(x, y + wave);
      } else {
        context.lineTo(x, y + wave);
      }
    }
    context.stroke();
  }

  for (let i = 0; i < 55; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    context.fillStyle = "rgba(58, 35, 21, 0.09)";
    context.beginPath();
    context.ellipse(x, y, 18 + Math.random() * 32, 1.4 + Math.random() * 2, Math.random() * Math.PI, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.5, 1);
  return texture;
}

function addFrame(scene: THREE.Scene) {
  const frameGroup = new THREE.Group();
  const frameMaterial = new THREE.MeshStandardMaterial({ color: "#f8f5ee", roughness: 0.42, metalness: 0.02 });
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: "#dfeae2",
    roughness: 0.1,
    metalness: 0,
    transmission: 0.35,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  });
  const sideGeometry = new THREE.BoxGeometry(0.18, 5.6, 0.2);
  const topGeometry = new THREE.BoxGeometry(4.8, 0.18, 0.2);
  const sillGeometry = new THREE.BoxGeometry(5.15, 0.18, 0.28);

  const left = new THREE.Mesh(sideGeometry, frameMaterial);
  left.position.set(-2.5, 0, -0.06);
  const right = new THREE.Mesh(sideGeometry, frameMaterial);
  right.position.set(2.5, 0, -0.06);
  const top = new THREE.Mesh(topGeometry, frameMaterial);
  top.position.set(0, 2.7, -0.06);
  const bottom = new THREE.Mesh(topGeometry, frameMaterial);
  bottom.position.set(0, -2.7, -0.06);
  const sill = new THREE.Mesh(sillGeometry, frameMaterial);
  sill.position.set(0, -2.98, 0.02);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(4.45, 5.15), glassMaterial);
  glass.position.set(0, 0, -0.15);

  frameGroup.add(glass, left, right, top, bottom, sill);
  scene.add(frameGroup);
  return frameGroup;
}

function addCords(cordGroup: THREE.Group, height: number) {
  cordGroup.clear();
  const cordMaterial = new THREE.MeshStandardMaterial({ color: "#e8dfcc", roughness: 0.8 });
  const cordGeometry = new THREE.CylinderGeometry(0.012, 0.012, height, 10);
  [-1.82, -0.62, 1.82].forEach((x) => {
    const leftCord = new THREE.Mesh(cordGeometry, cordMaterial);
    leftCord.position.set(x, 0.08, 0.22);
    cordGroup.add(leftCord);
  });

  const pullGeometry = new THREE.CylinderGeometry(0.01, 0.01, height * 0.88, 10);
  const pullCord = new THREE.Mesh(pullGeometry, cordMaterial);
  pullCord.position.set(-2.16, -0.12, 0.42);
  cordGroup.add(pullCord);

  const tassel = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.18, 8, 16), new THREE.MeshStandardMaterial({ color: "#d4c4a8", roughness: 0.55 }));
  tassel.position.set(-2.16, -height * 0.48, 0.42);
  cordGroup.add(tassel);
}

function updateBlind(refs: SceneRefs, tilt: number, lift: number) {
  const topY = 2.18;
  const fullSpacing = 0.255;
  const stackedSpacing = 0.045;
  const spacing = THREE.MathUtils.lerp(fullSpacing, stackedSpacing, lift);
  const tiltRad = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(-38, 42, tilt));
  const lowerY = topY - (refs.slats.length - 1) * spacing - 0.2;

  refs.slats.forEach((slat, index) => {
    slat.position.y = topY - index * spacing;
    slat.rotation.x = tiltRad;
    const visibleCutoff = refs.slats.length - lift * refs.slats.length * 0.62;
    slat.visible = index < visibleCutoff || lift < 0.08;
  });

  refs.bottomRail.position.y = lowerY;
  refs.bottomRail.rotation.x = tiltRad * 0.35;
  addCords(refs.cordGroup, Math.max(0.65, topY - lowerY + 0.35));
  refs.cordGroup.position.y = (topY + lowerY) / 2 - 0.03;
}

export function HeroWoodBlind3D() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const refsRef = useRef<SceneRefs | null>(null);
  const [tilt, setTilt] = useState(0.62);
  const [lift, setLift] = useState(0.08);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);
    camera.position.set(0.15, 0.02, 9.7);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight("#ffffff", "#c7b28f", 2.1));
    const key = new THREE.DirectionalLight("#fff6e8", 3.6);
    key.position.set(-3.2, 4.6, 5);
    key.castShadow = true;
    scene.add(key);
    const fill = new THREE.DirectionalLight("#d8e6dc", 1.2);
    fill.position.set(4, -1, 4);
    scene.add(fill);

    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(7.2, 7.1),
      new THREE.MeshStandardMaterial({ color: "#f5f1e7", roughness: 0.78 }),
    );
    wall.position.z = -0.3;
    scene.add(wall);

    const frameGroup = addFrame(scene);
    const woodMap = woodTexture();
    const slatMaterial = new THREE.MeshStandardMaterial({
      color: "#b47a48",
      map: woodMap ?? undefined,
      roughness: 0.48,
      metalness: 0.02,
    });
    const slatGeometry = new THREE.BoxGeometry(4.15, 0.07, 0.28, 12, 1, 2);
    const slats = Array.from({ length: 22 }, () => {
      const slat = new THREE.Mesh(slatGeometry, slatMaterial);
      slat.castShadow = true;
      slat.receiveShadow = true;
      slat.position.z = 0.2;
      scene.add(slat);
      return slat;
    });

    const railMaterial = new THREE.MeshStandardMaterial({ color: "#9c673e", map: woodMap ?? undefined, roughness: 0.42 });
    const headRail = new THREE.Mesh(new THREE.BoxGeometry(4.35, 0.22, 0.3), railMaterial);
    headRail.position.set(0, 2.36, 0.24);
    headRail.castShadow = true;
    scene.add(headRail);

    const bottomRail = new THREE.Mesh(new THREE.BoxGeometry(4.22, 0.13, 0.2), railMaterial);
    bottomRail.castShadow = true;
    scene.add(bottomRail);

    const cordGroup = new THREE.Group();
    scene.add(cordGroup);
    refsRef.current = { bottomRail, cordGroup, frameGroup, slats };
    updateBlind(refsRef.current, 0.62, 0.08);

    let rotationTarget = -0.11;
    let isDragging = false;
    let startX = 0;
    const onPointerDown = (event: PointerEvent) => {
      isDragging = true;
      startX = event.clientX;
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!isDragging) return;
      rotationTarget = THREE.MathUtils.clamp(-0.11 + (event.clientX - startX) / 900, -0.32, 0.22);
    };
    const onPointerUp = (event: PointerEvent) => {
      isDragging = false;
      renderer.domElement.releasePointerCapture(event.pointerId);
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    const resize = () => {
      const rect = host.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / rect.height;
      camera.position.z = rect.width < 520 ? 12.4 : 9.7;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    let animationId = 0;
    const render = () => {
      frameGroup.rotation.y = THREE.MathUtils.lerp(frameGroup.rotation.y, rotationTarget, 0.04);
      slats.forEach((slat) => {
        slat.rotation.y = frameGroup.rotation.y;
      });
      headRail.rotation.y = frameGroup.rotation.y;
      bottomRail.rotation.y = frameGroup.rotation.y;
      cordGroup.rotation.y = frameGroup.rotation.y;
      renderer.render(scene, camera);
      animationId = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      window.cancelAnimationFrame(animationId);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.dispose();
      slatGeometry.dispose();
      slatMaterial.dispose();
      railMaterial.dispose();
      woodMap?.dispose();
      host.replaceChildren();
    };
  }, []);

  useEffect(() => {
    if (refsRef.current) {
      updateBlind(refsRef.current, tilt, lift);
    }
  }, [tilt, lift]);

  return (
    <div className="hero-woodblind" aria-label="Interactieve 3D houten jaloezie">
      <div ref={hostRef} className="hero-woodblind-canvas" />
      <div className="hero-woodblind-controls" aria-label="3D jaloezie bediening">
        <label>
          <span>Tuimelen</span>
          <input type="range" min="0" max="1" step="0.01" value={tilt} onChange={(event) => setTilt(Number(event.target.value))} />
        </label>
        <label>
          <span>Optrekken</span>
          <input type="range" min="0" max="1" step="0.01" value={lift} onChange={(event) => setLift(Number(event.target.value))} />
        </label>
      </div>
    </div>
  );
}
