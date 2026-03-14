import * as THREE from 'three';
import React, { useState, useRef, Suspense, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { Torus, Sparkles, MeshDistortMaterial, Float, Environment, Html } from '@react-three/drei';
import { EffectComposer, Vignette } from '@react-three/postprocessing';
import { Mic, Menu, Users, X, ChevronRight, MessageSquare } from 'lucide-react';
import ForceGraph3D from 'react-force-graph-3d';

/* Prerequisites:
  npm install framer-motion three @react-three/fiber @react-three/drei lucide-react @react-three/postprocessing react-force-graph-3d
*/

// --- 1. Magnetic Interactive Component ---
const MagneticButton = ({ children, onClick, className, ariaLabel, isActive, hoverScale = 1.05 }) => {
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
    
    // Reduced the magnetic pull strength from 0.3 to 0.1 for a more subtle effect
    x.set(middleX * 0.1); 
    y.set(middleY * 0.1);
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
      whileHover={{ scale: isTouchDevice ? 1 : hoverScale }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`${className} ${isActive ? 'active' : ''}`}
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
    
    const targetX = pointerActive.current ? (state.pointer.x * Math.PI) / 6 : Math.sin(elapsedTime * 0.5) * 0.1;
    const targetY = pointerActive.current ? (state.pointer.y * Math.PI) / 6 : Math.cos(elapsedTime * 0.5) * 0.1;
    
    if (groupRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, targetX, 2, delta);
      groupRef.current.rotation.x = THREE.MathUtils.damp(groupRef.current.rotation.x, -targetY, 2, delta);
      const targetZ = isListening ? 0.5 : 0;
      groupRef.current.position.z = THREE.MathUtils.damp(groupRef.current.position.z, targetZ, 3, delta);
    }

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

// --- 3. Dynamic 3D Friends Graph Component ---
const FriendsGraph = ({ graphData, selectedNodeId, onNodeClick }) => {
  const containerRef = useRef();
  const fgRef = useRef();
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (selectedNodeId !== null && fgRef.current && graphData.nodes.length) {
      const node = graphData.nodes.find(n => n.id === selectedNodeId);
      if (node && node.x !== undefined) {
        const distance = 40;
        fgRef.current.cameraPosition(
          { x: node.x + distance, y: node.y + distance, z: node.z + distance }, 
          node, 
          2000  
        );
      }
    }
  }, [selectedNodeId, graphData]);

  return (
    <motion.div 
      ref={containerRef}
      className="graph-container"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
    >
      <ForceGraph3D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        backgroundColor="rgba(0,0,0,0)"
        nodeColor={node => node.id === selectedNodeId ? '#ffffff' : node.colour}
        nodeRelSize={6}
        linkWidth={1.5}
        linkColor={() => 'rgba(135, 135, 135, 0.3)'}
        enableNodeDrag={true}
        showNavInfo={false}
        onNodeClick={onNodeClick}
      />
    </motion.div>
  );
};

// --- 4. Floating Friends List Overlay ---
const FriendsListOverlay = ({ friends, isOpen, onClose, onSelectFriend, selectedFriendId }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            className="friends-overlay-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div 
            className="friends-list-panel"
            initial={{ x: '-100%', opacity: 0, filter: 'blur(10px)' }}
            animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={{ x: '-100%', opacity: 0, filter: 'blur(10px)' }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="friends-list-header">
              <h3>Connections</h3>
              <button className="close-btn" onClick={onClose}><X size={20} /></button>
            </div>
            <div className="friends-scroll-area">
              {friends.map((friend) => (
                <MagneticButton 
                  key={friend.id}
                  hoverScale={1.02}
                  className={`friend-list-item ${selectedFriendId === friend.id ? 'selected' : ''}`}
                  onClick={() => onSelectFriend(friend.id)}
                >
                  <div className="friend-avatar" style={{ backgroundColor: friend.colour }} />
                  <span className="friend-name">{friend.name}</span>
                  <motion.div className="chevron-wrapper">
                    <ChevronRight size={16} className="friend-chevron" />
                  </motion.div>
                </MagneticButton>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// --- 5. Setup Screen Component ---
const SetupScreen = ({ onComplete }) => {
  const [selectedInterests, setSelectedInterests] = useState([]);
  const interests = ["Architecture", "Minimalism", "Acoustics", "Creative Coding", "Typography", "Web3", "Industrial Design", "Photography"];

  const toggleInterest = (interest) => {
    setSelectedInterests(prev => prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]);
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
            key={interest} variants={itemVariants} 
            whileHover={{ scale: 1.05, y: -2 }}
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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="setup-footer">
            <MagneticButton className="continue-btn" hoverScale={1.03} onClick={onComplete}>Continue to Echo</MagneticButton>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// --- 6. Main Application Component ---
const App = () => {
  const [appState, setAppState] = useState('booting'); 
  const [activeTab, setActiveTab] = useState('voice'); 
  const [isListening, setIsListening] = useState(false);
  const [isFriendsListOpen, setIsFriendsListOpen] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState(null);

  const graphData = useMemo(() => {
    const nodes = [...Array(30).keys()].map(i => ({ 
      id: i, 
      name: `User ${String(i).padStart(2, '0')}`, 
      val: Math.random() * 2 + 1,
      colour: ['#0a0a0a', '#333333', '#555555', '#878787'][Math.floor(Math.random() * 4)]
    }));
    
    const links = [...Array(45).keys()].map(() => ({ 
      source: Math.floor(Math.random() * 30), 
      target: Math.floor(Math.random() * 30) 
    })).filter(l => l.source !== l.target);

    return { nodes, links };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setAppState('setup'), 2500); 
    return () => clearTimeout(timer);
  }, []);

  const toggleListening = useCallback(() => {
    if (activeTab !== 'voice') return;
    setIsListening(prev => {
      const newState = !prev;
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(newState ? [50, 50, 50] : 50); 
      }
      return newState;
    });
  }, [activeTab]);

  const handleSelectFriendFromList = (id) => {
    setActiveTab('friends'); 
    setSelectedFriendId(id);
    setIsFriendsListOpen(false); 
  };

  const handleNodeClick = useCallback((node) => {
    setSelectedFriendId(node.id);
  }, []);

  const styles = `
    :root {
      --bg-colour: #fafafa;
      --text-primary: #0a0a0a;
      --text-secondary: #878787;
      --panel-bg: rgba(255, 255, 255, 0.85);
      --transition-smooth: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
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
      cursor: pointer; outline: none; padding: 0; position: relative;
      transition: var(--transition-smooth);
    }
    
    .header-icon:hover {
      background: rgba(255, 255, 255, 0.9);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      border-color: rgba(0, 0, 0, 0.1);
    }

    .logo-text { font-size: 14px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; margin: 0; pointer-events: auto; cursor: pointer; transition: opacity 0.3s ease; }
    .logo-text:hover { opacity: 0.7; }

    .header-placeholder { width: 44px; height: 44px; pointer-events: none; } /* Keeps the logo centered */

    .content-area { flex: 1; position: relative; }
    .canvas-wrapper { position: absolute; inset: 0; z-index: 1; cursor: pointer; }
    .graph-container { position: absolute; inset: 0; z-index: 2; cursor: grab; }
    .graph-container:active { cursor: grabbing; }

    .interaction-overlay {
      position: absolute; top: calc(20% + env(safe-area-inset-top)); 
      left: 50%; transform: translateX(-50%);
      display: flex; flex-direction: column; align-items: center;
      pointer-events: none; z-index: 5;
    }

    .status-badge {
      padding: 8px 16px; border-radius: 24px; font-size: 11px; font-weight: 600; letter-spacing: 0.08em;
      text-transform: uppercase; background-color: rgba(255, 255, 255, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.8); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    }

    .forum-placeholder {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      justify-content: center; align-items: center; z-index: 10;
      background: var(--bg-colour); gap: 16px; text-align: center;
    }
    .forum-placeholder h2 { font-size: 24px; font-weight: 700; color: var(--text-primary); margin: 0; }
    .forum-placeholder p { font-size: 15px; color: var(--text-secondary); margin: 0; }

    .bottom-nav-wrapper {
      position: absolute; bottom: max(32px, env(safe-area-inset-bottom)); 
      left: 0; width: 100%; display: flex; justify-content: center; 
      z-index: 20; pointer-events: none; 
    }

    .bottom-nav {
      pointer-events: auto; display: inline-flex; justify-content: center; align-items: center;
      padding: 8px 16px; background: rgba(255, 255, 255, 0.8); gap: 16px;
      backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.9); border-radius: 40px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.08); width: auto;
      transition: var(--transition-smooth);
    }
    
    .bottom-nav:hover {
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.12);
      border-color: rgba(255, 255, 255, 1);
    }

    .nav-item {
      position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;
      cursor: pointer; color: var(--text-secondary); width: 48px; height: 48px; transition: var(--transition-smooth);
      border-radius: 50%; outline: none; border: none; background: transparent; -webkit-touch-callout: none;
    }
    
    .nav-item:hover { color: var(--text-primary); transform: translateY(-2px); }
    .nav-item.active { color: var(--text-primary); }
    .active-indicator { position: absolute; bottom: 4px; width: 5px; height: 5px; background-color: var(--text-primary); border-radius: 50%; }

    /* Friends List Overlay Styles */
    .friends-overlay-backdrop {
      position: absolute; inset: 0; background: rgba(250, 250, 250, 0.4);
      backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 40;
    }
    
    .friends-list-panel {
      position: absolute; top: 0; left: 0; bottom: 0; width: 100%; max-width: 380px;
      background: var(--panel-bg); backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px);
      border-right: 1px solid rgba(0, 0, 0, 0.05); z-index: 50; display: flex; flex-direction: column;
      box-shadow: 20px 0 40px rgba(0, 0, 0, 0.05); padding-top: max(24px, env(safe-area-inset-top));
    }

    .friends-list-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0 24px 20px 24px; border-bottom: 1px solid rgba(0,0,0,0.05);
    }

    .friends-list-header h3 { font-size: 18px; font-weight: 700; margin: 0; letter-spacing: -0.02em; }
    .close-btn { background: transparent; border: none; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; padding: 4px; border-radius: 50%; transition: var(--transition-smooth); }
    .close-btn:hover { color: var(--text-primary); transform: rotate(90deg); background: rgba(0,0,0,0.05); }

    .friends-scroll-area { flex: 1; overflow-y: auto; padding: 12px; }
    .friends-scroll-area::-webkit-scrollbar { display: none; }
    
    .friend-list-item {
      width: 100%; display: flex; align-items: center; gap: 16px; padding: 16px 12px;
      background: transparent; border: none; border-radius: 16px; cursor: pointer;
      text-align: left; transition: var(--transition-smooth);
    }
    
    .friend-list-item:hover { 
      background: rgba(0,0,0,0.03); 
      transform: translateX(4px);
    }
    
    .friend-list-item.selected { 
      background: rgba(0,0,0,0.06); 
      box-shadow: inset 2px 0 0 0 var(--text-primary);
    }
    
    .friend-avatar { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2); transition: var(--transition-smooth); }
    .friend-list-item:hover .friend-avatar { transform: scale(1.08); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    
    .friend-name { font-size: 15px; font-weight: 600; color: var(--text-primary); flex: 1; transition: var(--transition-smooth); }
    .friend-list-item:hover .friend-name { transform: translateX(2px); }
    
    .chevron-wrapper { display: flex; align-items: center; justify-content: center; transition: var(--transition-smooth); }
    .friend-chevron { color: var(--text-secondary); opacity: 0.5; transition: var(--transition-smooth); }
    .friend-list-item:hover .chevron-wrapper { transform: translateX(2px); }
    .friend-list-item:hover .friend-chevron { opacity: 1; color: var(--text-primary); }

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
      font-size: 14px; font-weight: 500; cursor: pointer; transition: var(--transition-smooth); color: var(--text-secondary);
    }
    
    .interest-pill:hover:not(.selected) {
      border-color: #ccc;
      background: rgba(0,0,0,0.02);
      color: var(--text-primary);
    }
    
    .interest-pill.selected { 
      background: var(--text-primary); color: var(--bg-colour); border-color: var(--text-primary); 
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    
    .setup-footer { display: flex; justify-content: center; width: 100%; padding-top: 24px; }
    
    .continue-btn {
      background: var(--text-primary); color: var(--bg-colour); border: none; border-radius: 30px;
      padding: 16px 32px; font-size: 15px; font-weight: 600; cursor: pointer; width: 100%; max-width: 300px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15); transition: var(--transition-smooth);
    }
    
    .continue-btn:hover {
      box-shadow: 0 12px 32px rgba(0,0,0,0.25);
      background: #1a1a1a;
      transform: translateY(-2px);
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
              exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)', transition: { duration: 1.2, ease: "easeInOut" } }}
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
              <MagneticButton 
                className="header-icon" 
                ariaLabel="Menu"
                hoverScale={1.1}
                onClick={() => setIsFriendsListOpen(true)}
              >
                <Menu size={20} color="var(--text-primary)" strokeWidth={1.5} />
              </MagneticButton>
              <motion.h1 className="logo-text" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}>Echo</motion.h1>
              {/* Replaced the Notification bell with an invisible placeholder to keep the layout perfectly centered */}
              <div className="header-placeholder" /> 
            </header>
          )}

          <main className="content-area">
            {/* The 3D Canvas is universally rendered in the background, but only displays the Audio Ring when on the voice tab */}
            <div className="canvas-wrapper" onClick={appState === 'main' && activeTab === 'voice' ? toggleListening : undefined}>
              <Canvas camera={{ position: [0, 0, 5], fov: 40 }} dpr={[1, Math.min(2, window.devicePixelRatio)]}>
                <color attach="background" args={['#fafafa']} />
                <Suspense fallback={<CanvasLoader />}>
                  <ambientLight intensity={1} />
                  <directionalLight position={[5, 5, 5]} intensity={2} />
                  <directionalLight position={[-5, -5, -2]} intensity={1} />
                  <Environment preset="studio" />
                  {activeTab === 'voice' && <ReactiveAudioRing isListening={isListening} />}
                  <EffectComposer disableNormalPass>
                    <Vignette eskil={false} offset={0.1} darkness={0.4} />
                  </EffectComposer>
                </Suspense>
              </Canvas>
            </div>

            <AnimatePresence mode="wait">
              {appState === 'setup' && <SetupScreen key="setup" onComplete={() => setAppState('main')} />}
              
              {appState === 'main' && activeTab === 'friends' && (
                <FriendsGraph 
                  key="friends-graph" 
                  graphData={graphData} 
                  selectedNodeId={selectedFriendId}
                  onNodeClick={handleNodeClick}
                />
              )}

              {/* Added a clean placeholder view for the new Forum tab */}
              {appState === 'main' && activeTab === 'forum' && (
                <motion.div 
                  key="forum-view"
                  className="forum-placeholder"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                >
                  <MessageSquare size={48} color="var(--text-secondary)" strokeWidth={1} />
                  <h2>Community Forum</h2>
                  <p>Discussions will appear here.</p>
                </motion.div>
              )}
              
              {appState === 'main' && activeTab === 'voice' && (
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

            <FriendsListOverlay 
              friends={graphData.nodes}
              isOpen={isFriendsListOpen}
              onClose={() => setIsFriendsListOpen(false)}
              onSelectFriend={handleSelectFriendFromList}
              selectedFriendId={selectedFriendId}
            />
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
                    isActive={activeTab === 'voice'}
                    className="nav-item" 
                    ariaLabel="Voice Hub"
                    hoverScale={1.15}
                    onClick={() => setActiveTab('voice')}
                  >
                    <Mic size={22} strokeWidth={2} />
                    {activeTab === 'voice' && (
                      <motion.div layoutId="activeTabIndicator" className="active-indicator" initial={false} transition={{ type: "spring", stiffness: 400, damping: 25 }} />
                    )}
                  </MagneticButton>

                  <MagneticButton 
                    isActive={activeTab === 'friends'}
                    className="nav-item" 
                    ariaLabel="Friends Network"
                    hoverScale={1.15}
                    onClick={() => {
                      setActiveTab('friends');
                      setIsListening(false);
                    }}
                  >
                    <Users size={22} strokeWidth={2} />
                    {activeTab === 'friends' && (
                      <motion.div layoutId="activeTabIndicator" className="active-indicator" initial={false} transition={{ type: "spring", stiffness: 400, damping: 25 }} />
                    )}
                  </MagneticButton>

                  {/* Added the new Forum tab to the navigation */}
                  <MagneticButton 
                    isActive={activeTab === 'forum'}
                    className="nav-item" 
                    ariaLabel="Community Forum"
                    hoverScale={1.15}
                    onClick={() => {
                      setActiveTab('forum');
                      setIsListening(false);
                    }}
                  >
                    <MessageSquare size={22} strokeWidth={2} />
                    {activeTab === 'forum' && (
                      <motion.div layoutId="activeTabIndicator" className="active-indicator" initial={false} transition={{ type: "spring", stiffness: 400, damping: 25 }} />
                    )}
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