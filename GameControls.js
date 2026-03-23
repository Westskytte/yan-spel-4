import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import htm from 'htm';
import { playThudSound } from '../utils/audio.js';

const html = htm.bind(React.createElement);

export default function DiceCanvas({ dice, held, toggleHold, isRolling }) {
    const containerRef = useRef();
    const sceneRef = useRef();
    const rendererRef = useRef();
    const diceRefs = useRef([]);
    const physicsRefs = useRef({ world: null, bodies: [] });
    const stateRef = useRef({ dice, held, isRolling });
    const lastIsRollingRef = useRef(isRolling);
    const frameRef = useRef();
    const toggleHoldRef = useRef(toggleHold);

    const impactRingsRef = useRef([]);
    const shakeIntensityRef = useRef(0);

    // Update stateRef whenever props change to avoid closure staleness
    useEffect(() => {
        stateRef.current = { dice, held, isRolling };
        toggleHoldRef.current = toggleHold;
        
        // Handle roll start
        if (isRolling && !lastIsRollingRef.current) {
            tossDice();
            // Add a little extra "oomph" to the camera on toss
            shakeIntensityRef.current = Math.max(shakeIntensityRef.current, 0.4);
        }
        lastIsRollingRef.current = isRolling;
    }, [dice, held, isRolling]);

    const createImpactRing = (x, z, scale = 1) => {
        const scene = sceneRef.current;
        if (!scene) return;

        const geometry = new THREE.RingGeometry(0.1, 0.2, 32);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0x4ade80, 
            transparent: true, 
            opacity: 0.6,
            side: THREE.DoubleSide 
        });
        const ring = new THREE.Mesh(geometry, material);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, 0.02, z);
        ring.scale.setScalar(scale);
        scene.add(ring);
        
        impactRingsRef.current.push({
            mesh: ring,
            life: 1.0,
            speed: 2.0 + Math.random() * 2.0
        });
    };

    const tossDice = () => {
        const { bodies } = physicsRefs.current;
        const { held: currentHeld } = stateRef.current;
        
        if (!bodies || !bodies.length) return;

        bodies.forEach((body, i) => {
            if (body && (!currentHeld || !currentHeld[i])) {
                // Reset position above table with some spread
                const angle = (i / bodies.length) * Math.PI * 2;
                const radius = 3;
                body.position.set(
                    Math.cos(angle) * radius + (Math.random() - 0.5) * 2, 
                    12 + Math.random() * 4, 
                    Math.sin(angle) * radius + (Math.random() - 0.5) * 2
                );
                body.velocity.set(
                    -body.position.x * 2 + (Math.random() - 0.5) * 10,
                    -20 - Math.random() * 15,
                    -body.position.z * 2 + (Math.random() - 0.5) * 10
                );
                body.angularVelocity.set(
                    (Math.random() - 0.5) * 40,
                    (Math.random() - 0.5) * 40,
                    (Math.random() - 0.5) * 40
                );
            }
        });
    };

    useEffect(() => {
        if (!containerRef.current) return;

        // Initialize Scene
        const scene = new THREE.Scene();
        sceneRef.current = scene;
        
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
        camera.position.set(0, 15, 15);
        camera.lookAt(0, 0, 0);
        
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        rendererRef.current = renderer;
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientWidth);
        renderer.shadowMap.enabled = true;
        containerRef.current.appendChild(renderer.domElement);

        // Physics World
        const world = new CANNON.World();
        world.gravity.set(0, -40, 0);
        physicsRefs.current.world = world;

        // Ground Plane (Physics)
        const groundBody = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Plane(),
            material: new CANNON.Material({ friction: 0.1, restitution: 0.5 })
        });
        groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        world.addBody(groundBody);

        // Ground Plane (Visual - transparent but receives shadows)
        const groundGeo = new THREE.PlaneGeometry(50, 50);
        const groundMat = new THREE.ShadowMaterial({ opacity: 0.2 });
        const groundMesh = new THREE.Mesh(groundGeo, groundMat);
        groundMesh.rotation.x = -Math.PI / 2;
        groundMesh.receiveShadow = true;
        scene.add(groundMesh);

        // Walls to keep dice on screen
        const wallMaterial = new CANNON.Material({ friction: 0, restitution: 0.8 });
        [
            { pos: [0, 0, 7.5], rot: [0, Math.PI, 0] },
            { pos: [0, 0, -7.5], rot: [0, 0, 0] },
            { pos: [7.5, 0, 0], rot: [0, -Math.PI / 2, 0] },
            { pos: [-7.5, 0, 0], rot: [0, Math.PI / 2, 0] }
        ].forEach(w => {
            const wallBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: wallMaterial });
            wallBody.position.set(...w.pos);
            wallBody.quaternion.setFromEuler(...w.rot);
            world.addBody(wallBody);
        });

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        
        const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
        mainLight.position.set(10, 20, 10);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 1024;
        mainLight.shadow.mapSize.height = 1024;
        scene.add(mainLight);

        // Helper for drawing dots on textures
        const createDiceTexture = (value) => {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 256, 256);
            ctx.strokeStyle = '#e0e0e0';
            ctx.lineWidth = 15;
            ctx.strokeRect(0, 0, 256, 256);
            ctx.fillStyle = '#1a1a1a';
            const dot = (x, y) => {
                ctx.beginPath();
                ctx.arc(x, y, 22, 0, Math.PI * 2);
                ctx.fill();
                // Little highlight on dot
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.beginPath();
                ctx.arc(x - 5, y - 5, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#1a1a1a';
            };
            const center = 128, left = 64, right = 192, top = 64, bottom = 192;
            if (value % 2 === 1) dot(center, center);
            if (value > 1) { dot(left, top); dot(right, bottom); }
            if (value > 3) { dot(right, top); dot(left, bottom); }
            if (value === 6) { dot(left, center); dot(right, center); }
            return new THREE.CanvasTexture(canvas);
        };

        const diceTextures = [1,2,3,4,5,6].map(v => createDiceTexture(v));

        // Die Creation function
        const createDie = (x, z, index) => {
            const size = 1.1;
            const geometry = new THREE.BoxGeometry(size * 2, size * 2, size * 2);
            const materials = [
                new THREE.MeshStandardMaterial({ map: diceTextures[2] }), // +x: 3
                new THREE.MeshStandardMaterial({ map: diceTextures[3] }), // -x: 4
                new THREE.MeshStandardMaterial({ map: diceTextures[0] }), // +y: 1
                new THREE.MeshStandardMaterial({ map: diceTextures[5] }), // -y: 6
                new THREE.MeshStandardMaterial({ map: diceTextures[1] }), // +z: 2
                new THREE.MeshStandardMaterial({ map: diceTextures[4] }), // -z: 5
            ];

            const dieMesh = new THREE.Mesh(geometry, materials);
            dieMesh.castShadow = true;
            dieMesh.userData.index = index;
            scene.add(dieMesh);

            const shape = new CANNON.Box(new CANNON.Vec3(size, size, size));
            const body = new CANNON.Body({
                mass: 1,
                shape: shape,
                material: new CANNON.Material({ friction: 0.1, restitution: 0.5 })
            });
            body.position.set(x, 1.1, z);
            
            // Collision sound with physics-based volume
            body.addEventListener('collide', (e) => {
                if (e.contact && typeof e.contact.getImpactVelocityAlongNormal === 'function') {
                    const relativeVelocity = e.contact.getImpactVelocityAlongNormal();
                    const absVel = Math.abs(relativeVelocity);
                    // Increased threshold to avoid micro-vibration sounds
                    if (absVel > 1.5) {
                        // Better logarithmic-feeling volume mapping
                        const volume = Math.min(1.0, Math.pow(absVel / 15, 0.5));
                        playThudSound(volume);

                        // Visual feedback on impact
                        if (e.contact.bj.mass === 0 || e.contact.bi.mass === 0) { // Hit floor/walls
                            const impactPoint = e.contact.rj;
                            const worldX = body.position.x + impactPoint.x;
                            const worldZ = body.position.z + impactPoint.z;
                            createImpactRing(worldX, worldZ, volume * 2);
                            
                            // Screen shake proportional to impact
                            if (volume > 0.3) {
                                shakeIntensityRef.current = Math.min(0.5, shakeIntensityRef.current + volume * 0.2);
                            }
                        }
                    }
                }
            });

            world.addBody(body);
            physicsRefs.current.bodies.push(body);
            return dieMesh;
        };

        const diceMeshes = [
            createDie(-3, 0, 0),
            createDie(-1.5, 0, 1),
            createDie(0, 0, 2),
            createDie(1.5, 0, 3),
            createDie(3, 0, 4)
        ];
        diceRefs.current = diceMeshes;

        const animate = () => {
            frameRef.current = requestAnimationFrame(animate);
            const { dice: currentDice, held: currentHeld, isRolling: currentIsRolling } = stateRef.current;
            
            world.step(1/60);

            // Handle Camera Shake
            if (shakeIntensityRef.current > 0.01) {
                const shake = shakeIntensityRef.current;
                camera.position.x = (Math.random() - 0.5) * shake;
                camera.position.y = 15 + (Math.random() - 0.5) * shake;
                camera.position.z = 15 + (Math.random() - 0.5) * shake;
                shakeIntensityRef.current *= 0.9; // Decay
            } else {
                camera.position.set(0, 15, 15);
            }
            camera.lookAt(0, 0, 0);

            // Update Impact Rings
            impactRingsRef.current = impactRingsRef.current.filter(ring => {
                ring.life -= 0.05;
                if (ring.life <= 0) {
                    scene.remove(ring.mesh);
                    ring.mesh.geometry.dispose();
                    ring.mesh.material.dispose();
                    return false;
                }
                ring.mesh.scale.addScalar(ring.speed * 0.02);
                ring.mesh.material.opacity = ring.life * 0.6;
                return true;
            });

            diceMeshes.forEach((die, i) => {
                const body = physicsRefs.current.bodies[i];
                if (!body) return;
                
                const targetScale = currentHeld[i] ? 1.15 : 1;
                die.scale.setScalar(THREE.MathUtils.lerp(die.scale.x, targetScale, 0.2));
                
                if (!currentIsRolling || currentHeld[i]) {
                    const targetPos = new THREE.Vector3((i - 2) * 2.8, currentHeld[i] ? 2.2 : 1.1, 0);
                    die.position.lerp(targetPos, 0.2);
                    
                    const targetRot = getRotationForValue(currentDice[i]);
                    const targetQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(targetRot.x, targetRot.y, targetRot.z));
                    die.quaternion.slerp(targetQuat, 0.2);
                    
                    // Sync physics body for next roll
                    body.position.copy(die.position);
                    body.quaternion.copy(die.quaternion);
                    body.velocity.set(0,0,0);
                    body.angularVelocity.set(0,0,0);
                } else {
                    die.position.copy(body.position);
                    die.quaternion.copy(body.quaternion);
                }
                
                die.material.forEach(m => {
                   m.emissive.set(currentHeld[i] ? 0xffcc00 : 0x000000);
                   m.emissiveIntensity = currentHeld[i] ? 0.4 : 0;
                });
            });

            if (rendererRef.current) {
                rendererRef.current.render(scene, camera);
            }
        };

        animate();

        const handleResize = () => {
            if (containerRef.current && rendererRef.current) {
                const width = containerRef.current.clientWidth;
                rendererRef.current.setSize(width, width);
                camera.aspect = 1;
                camera.updateProjectionMatrix();
            }
        };
        window.addEventListener('resize', handleResize);

        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        const onPointerUp = (event) => {
            if (!rendererRef.current || !rendererRef.current.domElement) return;
            const rect = rendererRef.current.domElement.getBoundingClientRect();
            
            const x = event.clientX;
            const y = event.clientY;
            
            mouse.x = ((x - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((y - rect.top) / rect.height) * 2 + 1;
            
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(diceMeshes);
            if (intersects.length > 0) {
                const index = intersects[0].object.userData.index;
                if (typeof toggleHoldRef.current === 'function') {
                    toggleHoldRef.current(index);
                }
            }
        };
        rendererRef.current.domElement.addEventListener('pointerup', onPointerUp);

        return () => {
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
            window.removeEventListener('resize', handleResize);
            const renderer = rendererRef.current;
            if (renderer && renderer.domElement) {
                renderer.domElement.removeEventListener('pointerup', onPointerUp);
                if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
                    containerRef.current.removeChild(renderer.domElement);
                }
                renderer.dispose();
            }
            diceMeshes.forEach(die => {
                die.geometry.dispose();
                if (Array.isArray(die.material)) {
                    die.material.forEach(m => m.dispose());
                } else {
                    die.material.dispose();
                }
            });
            diceTextures.forEach(t => t.dispose());
            physicsRefs.current.bodies = [];
        };
    }, []); 

    const getRotationForValue = (val) => {
        switch(val) {
            case 1: return { x: 0, y: 0, z: 0 };
            case 6: return { x: Math.PI, y: 0, z: 0 };
            case 2: return { x: -Math.PI / 2, y: 0, z: 0 };
            case 5: return { x: Math.PI / 2, y: 0, z: 0 };
            case 3: return { x: 0, y: 0, z: Math.PI / 2 };
            case 4: return { x: 0, y: 0, z: -Math.PI / 2 };
            default: return { x: 0, y: 0, z: 0 };
        }
    };

    return html`
        <div ref=${containerRef} className="w-full aspect-square relative mb-4 overflow-hidden cursor-pointer" />
    `;
}
