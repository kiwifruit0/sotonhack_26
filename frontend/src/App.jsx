import * as THREE from 'three';
import React, { useState, useRef, Suspense, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { Torus, Sparkles, MeshDistortMaterial, Float, Environment, Html } from '@react-three/drei';
import { EffectComposer, Vignette } from '@react-three/postprocessing';
import { Mic, Bell, Menu } from 'lucide-react';

/* Prerequisites:
  npm install framer-motion three @react-three/fiber @react-three/drei lucide-react @react-three/postprocessing
*/

// --- 1. Magnetic Interactive Component ---
const MagneticButton = ({ children, onClick, className, ariaLabel }) => {
  const ref = useRef(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { damping: 15, stiffness: 150, mass: 0.1 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  useEffect(() => {
    const matchMedia = window.matchMedia("(pointer: coarse)");
    setIsTouchDevice(matchMedia.matches);
  }, []);

  const handleMouseMove = (e) => {
    if (isTouchDevice || !ref.current) return;
    const { clientX, clientY } = e;
    const { height, width, left, top } = ref.current.getBoundingClientRect();
    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);
    x.set(middleX * 0.3); 
    y.set(middleY * 0.3);
  };

  const handleMouseLeave = () => {
    if (isTouchDevice) return;
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={isTouchDevice ? {} : { x: springX, y: springY }}
      whileTap={{ scale: 0.85 }}
      className={className}
      aria-label={ariaLabel}
    >
      {children}
    </motion.button>
  );
};

// --- 2. 3D Component: Parallax & Reactive Audio Ring ---
const ReactiveAudioRing = ({ isListening }) => {
  const groupRef = useRef();
  const outerRingRef = useRef();
  const middleRingRef = useRef();
  const innerRingRef = useRef();
  const materialRef = useRef();
  const pointerActive = useRef(false);

  useEffect(() => {
    const handlePointerDown = () => (pointerActive.current = true);
    const handlePointerUp = () => (pointerActive.current = false);
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  useFrame((state, delta) => {
    const elapsedTime = state.clock.getElapsedTime();
    
    // Parallax logic
    const targetX = pointerActive.current ? (state.pointer.x * Math.PI) / 6 : Math.sin(elapsedTime * 0.5) * 0.1;
    const targetY = pointerActive.current ? (state.pointer.y * Math.PI) / 6 : Math.cos(elapsedTime * 0.5) * 0.1;
    
    if (groupRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, targetX, 2, delta);
      groupRef.current.rotation.x = THREE.MathUtils.damp(groupRef.current.rotation.x, -targetY, 2, delta);
      // Bring the ring slightly forward when there is no UI overlay blocking it
      const targetZ = isListening ? 0.5 : 0;
      groupRef.current.position.z = THREE.MathUtils.damp(groupRef.current.position.z, targetZ, 3, delta);
    }

    // Audio reactive distortion and scaling
    const targetDistort = isListening ? 0.8 : 0.1;
    const targetSpeed = isListening ? 6 : 1;
    const basePulse = isListening ? Math.sin(elapsedTime * 8) * 0.04 : Math.sin(elapsedTime * 2) * 0.01;
    
    const targetOuterScale = 1 + basePulse;
    const targetMiddleScale = isListening ? 1.1 : 0.95;
    const targetInnerScale = isListening ? 0.8 : 0.9;
    
    if (materialRef.current) {
      materialRef.current.distort = THREE.MathUtils.damp(materialRef.current.distort, targetDistort, 4, delta);
      materialRef.current.speed = THREE.MathUtils.damp(materialRef.current.speed, targetSpeed, 4, delta);
    }

    if (outerRingRef.current && middleRingRef.current && innerRingRef.current) {
      outerRingRef.current.rotation.x = elapsedTime * 0.15;
      outerRingRef.current.rotation.y = elapsedTime * 0.2;
      
      middleRingRef.current.rotation.x = elapsedTime * -0.2;
      middleRingRef.current.rotation.y = elapsedTime * 0.1;
      middleRingRef.current.rotation.z = elapsedTime * 0.1;

      innerRingRef.current.rotation.y = elapsedTime * -0.3;
      innerRingRef.current.rotation.z = elapsedTime * -0.2;

      const currentOuter = outerRingRef.current.scale.x;
      const newOuter = THREE.MathUtils.damp(currentOuter, targetOuterScale, 6, delta);
      outerRingRef.current.scale.set(newOuter, newOuter, newOuter);

      const currentMiddle = middleRingRef.current.scale.x;
      const newMiddle = THREE.MathUtils.damp(currentMiddle, targetMiddleScale, 5, delta);
      middleRingRef.current.scale.set(newMiddle, newMiddle, newMiddle);

      const currentInner = innerRingRef.current.scale.x;
      const newInner = THREE.MathUtils.damp(currentInner, targetInnerScale, 4, delta);
      innerRingRef.current.scale.set(newInner, newInner, newInner);
    }
  });

  return (
    <group ref={groupRef}>
      <Float speed={isListening ? 3 : 1.5} rotationIntensity={0.3} floatIntensity={0.4}>
        <Torus ref={outerRingRef} args={[0.6, 0.04, 64, 128]}>
          <MeshDistortMaterial ref={materialRef} color="#000000" attach="material" roughness={0.2} metalness={0.9} clearcoat={1} />
        </Torus>
        <Torus ref={middleRingRef} args={[0.5, 0.008, 32, 100]}>
          <meshStandardMaterial color="#555555" wireframe={true} transparent opacity={0.5} />
        </Torus>
        <Torus ref={innerRingRef} args={[0.4, 0.01, 32, 64]}>
          <meshStandardMaterial color="#111111" roughness={0.1} metalness={0.8} />
        </Torus>
      </Float>
      <Sparkles count={isListening ? 120 : 50} scale={2.5} size={isListening ? 1.5 : 0.8} speed={isListening ? 2 : 0.4} opacity={isListening ? 0.6 : 0.2} color="#000000" noise={2} />
    </group>
  );
};

const CanvasLoader = () => (
  <Html center>
    <div className="loader-text" style={{ color: '#878787', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
      Initialising...
    </div>
  </Html>
);

// --- 3. Setup Screen Component ---
const SetupScreen = ({ onComplete }) => {
  const [selectedInterests, setSelectedInterests] = useState([]);
  
  const interests = [
    "Architecture", "Minimalism", "Acoustics", "Creative Coding", 
    "Typography", "Web3", "Industrial Design", "Photography"
  ];

  const toggleInterest = (interest) => {
    setSelectedInterests(prev => 
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.2 } },
    exit: { opacity: 0, y: -20, filter: 'blur(10px)', transition: { duration: 0.4 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div className="setup-container" variants={containerVariants} initial="hidden" animate="show" exit="exit">
      <motion.div variants={itemVariants} className="setup-header">
        <h2>Curate your space.</h2>
        <p>Select your interests to tailor your voice feed. We'll add voice-setup in the future.</p>
      </motion.div>
      
      <div className="interests-grid">
        {interests.map(interest => (
          <motion.button
            key={interest}
            variants={itemVariants}
            whileTap={{ scale: 0.95 }}
            onClick={() => toggleInterest(interest)}
            className={`interest-pill ${selectedInterests.includes(interest) ? 'selected' : ''}`}
          >
            {interest}
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {selectedInterests.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="setup-footer"
          >
            <MagneticButton className="continue-btn" onClick={onComplete}>
              Continue to Echo
            </MagneticButton>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// --- 4. Main Application Component ---
const App = () => {
  const [appState, setAppState] = useState('booting'); // 'booting', 'setup', 'main'
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAppState('setup'), 2500); 
    return () => clearTimeout(timer);
  }, []);

  const toggleListening = useCallback(() => {
    setIsListening(prev => {
      const newState = !prev;
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(newState ? [50, 50, 50] : 50); 
      }
      return newState;
    });
  }, []);

  const styles = `
    :root {
      --bg-colour: #fafafa;
      --text-primary: #0a0a0a;
      --text-secondary: #878787;
    }

    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

    .app-wrapper {
      position: relative; height: 100vh; height: 100dvh; 
      width: 100vw; background-color: var(--text-primary);
      overflow: hidden; font-family: 'Inter', -apple-system, sans-serif;
    }

    .loading-screen {
      position: absolute; inset: 0; display: flex; justify-content: center; align-items: center;
      background-color: var(--text-primary); color: var(--bg-colour); z-index: 100;
    }
    .loading-text { font-size: 24px; font-weight: 800; letter-spacing: 0.4em; }

    .main-app {
      display: flex; flex-direction: column; height: 100%;
      background-color: var(--bg-colour); color: var(--text-primary); position: relative;
    }

    .top-header {
      position: absolute; top: 0; left: 0; width: 100%;
      display: flex; justify-content: space-between; align-items: center;
      padding: max(24px, env(safe-area-inset-top)) 32px 24px 32px;
      z-index: 20; background: linear-gradient(to bottom, rgba(250,250,250,0.95) 0%, rgba(250,250,250,0) 100%);
      pointer-events: none;
    }

    .header-icon {
      pointer-events: auto; background: rgba(255, 255, 255, 0.5);
      backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(0, 0, 0, 0.05); border-radius: 50%;
      width: 44px; height: 44px; display: flex; justify-content: center; align-items: center;
      cursor: pointer; outline: none; padding: 0;
    }

    .logo-text { font-size: 14px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; margin: 0; pointer-events: auto; }

    .content-area { flex: 1; position: relative; }
    
    .canvas-wrapper { 
      position: absolute; inset: 0; z-index: 1; 
      cursor: pointer; /* Re-enabled clicking on the canvas */
    }

    .interaction-overlay {
      position: absolute; 
      top: calc(20% + env(safe-area-inset-top)); 
      left: 50%; transform: translateX(-50%);
      display: flex; flex-direction: column; align-items: center;
      pointer-events: none; z-index: 5;
    }

    .status-badge {
      padding: 8px 16px; border-radius: 24px;
      font-size: 11px; font-weight: 600; letter-spacing: 0.08em;
      text-transform: uppercase;
      background-color: rgba(255, 255, 255, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.8);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    }

    .bottom-nav-wrapper {
      position: absolute; bottom: max(32px, env(safe-area-inset-bottom)); 
      left: 0; width: 100%; display: flex; justify-content: center; 
      z-index: 20; pointer-events: none; 
    }

    .bottom-nav {
      pointer-events: auto; display: inline-flex; justify-content: center; align-items: center;
      padding: 12px 32px; background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.9); border-radius: 40px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.08); width: auto;
    }

    .nav-item {
      position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;
      cursor: pointer; color: var(--text-primary); width: 48px; height: 48px; transition: color 0.3s ease;
      border-radius: 50%; outline: none; border: none; background: transparent; -webkit-touch-callout: none;
    }

    .active-indicator { position: absolute; bottom: 2px; width: 5px; height: 5px; background-color: var(--text-primary); border-radius: 50%; }

    /* Setup Screen Styles */
    .setup-container {
      position: absolute; inset: 0; z-index: 30; background: var(--bg-colour);
      display: flex; flex-direction: column; padding: max(120px, env(safe-area-inset-top)) 32px 40px 32px;
    }
    .setup-header { margin-bottom: 40px; }
    .setup-header h2 { font-size: 32px; font-weight: 800; margin: 0 0 12px 0; letter-spacing: -0.03em; }
    .setup-header p { font-size: 16px; color: var(--text-secondary); line-height: 1.5; margin: 0; max-width: 300px; }
    
    .interests-grid { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: auto; }
    .interest-pill {
      padding: 12px 20px; border-radius: 30px; border: 1px solid #eaeaea; background: transparent;
      font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.3s ease; color: var(--text-secondary);
    }
    .interest-pill.selected { background: var(--text-primary); color: var(--bg-colour); border-color: var(--text-primary); }
    
    .setup-footer { display: flex; justify-content: center; width: 100%; padding-top: 24px; }
    .continue-btn {
      background: var(--text-primary); color: var(--bg-colour); border: none; border-radius: 30px;
      padding: 16px 32px; font-size: 15px; font-weight: 600; cursor: pointer; width: 100%; max-width: 300px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    }
  `;

  return (
    <>
      <style>{styles}</style>
      <div className="app-wrapper">
        
        <AnimatePresence>
          {appState === 'booting' && (
            <motion.div 
              className="loading-screen" 
              exit={{ 
                opacity: 0, 
                scale: 1.1, 
                filter: 'blur(20px)', 
                transition: { duration: 1.2, ease: "easeInOut" } 
              }}
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }} 
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} 
                transition={{ duration: 1.5, ease: "easeOut" }} 
                className="loading-text"
              >
                E C H O
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="main-app">
          {appState !== 'booting' && (
            <header className="top-header">
              <MagneticButton className="header-icon" ariaLabel="Menu"><Menu size={20} color="var(--text-primary)" strokeWidth={1.5} /></MagneticButton>
              <motion.h1 className="logo-text" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}>Echo</motion.h1>
              <MagneticButton className="header-icon" ariaLabel="Notifications"><Bell size={20} color="var(--text-primary)" strokeWidth={1.5} /></MagneticButton>
            </header>
          )}

          <main className="content-area">
            
            {/* When appState is 'main', the canvas wrapper catches clicks to toggle the listening state.
              The 3D Canvas renders persistently.
            */}
            <div 
              className="canvas-wrapper" 
              onClick={appState === 'main' ? toggleListening : undefined}
            >
              <Canvas camera={{ position: [0, 0, 5], fov: 40 }} dpr={[1, Math.min(2, window.devicePixelRatio)]}>
                <color attach="background" args={['#fafafa']} />
                <Suspense fallback={<CanvasLoader />}>
                  <ambientLight intensity={1} />
                  <directionalLight position={[5, 5, 5]} intensity={2} />
                  <directionalLight position={[-5, -5, -2]} intensity={1} />
                  <Environment preset="studio" />
                  <ReactiveAudioRing isListening={isListening} />
                  <EffectComposer disableNormalPass>
                    <Vignette eskil={false} offset={0.1} darkness={0.4} />
                  </EffectComposer>
                </Suspense>
              </Canvas>
            </div>

            <AnimatePresence mode="wait">
              {appState === 'setup' && (
                <SetupScreen key="setup" onComplete={() => setAppState('main')} />
              )}
              
              {/* Restored the clean, subtle status indicator overlay for the main page */}
              {appState === 'main' && (
                <div className="interaction-overlay" key="interaction-overlay">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={isListening ? 'listening' : 'idle'}
                      initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                      transition={{ duration: 0.3 }}
                      className="status-badge"
                      style={{ color: isListening ? '#0a0a0a' : '#878787' }}
                    >
                      {isListening ? "Listening..." : "Tap anywhere to capture"}
                    </motion.div>
                  </AnimatePresence>
                </div>
              )}
            </AnimatePresence>
          </main>

          <AnimatePresence>
            {appState === 'main' && (
              <motion.div 
                className="bottom-nav-wrapper"
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 250, damping: 22 }}
              >
                <nav className="bottom-nav">
                  <MagneticButton 
                    className="nav-item active" 
                    ariaLabel="Voice Hub"
                    onClick={toggleListening}
                  >
                    <Mic size={22} strokeWidth={2} />
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="active-indicator"
                      initial={false}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    />
                  </MagneticButton>
                </nav>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
};

export default App;