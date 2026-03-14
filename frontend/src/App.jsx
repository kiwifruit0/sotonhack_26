import * as THREE from 'three';
import React, { useState, useRef, Suspense, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { Torus, Sparkles, MeshDistortMaterial, Float, Environment, Html } from '@react-three/drei';
import { EffectComposer, Vignette } from '@react-three/postprocessing';
import { Mic, Menu, Users, X, ChevronRight, MessageSquare, ArrowLeft, Eye, EyeOff, LogOut } from 'lucide-react';
import ForceGraph3D from 'react-force-graph-3d';
import { useConversation } from '@elevenlabs/react';

/* Prerequisites:
  npm install framer-motion three @react-three/fiber @react-three/drei lucide-react @react-three/postprocessing react-force-graph-3d @elevenlabs/react
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
const ReactiveAudioRing = ({ isListening, volume = 0 }) => {
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
    const voiceBoost = volume * 1.5;

    const targetX = pointerActive.current ? (state.pointer.x * Math.PI) / 6 : Math.sin(elapsedTime * 0.5) * 0.1;
    const targetY = pointerActive.current ? (state.pointer.y * Math.PI) / 6 : Math.cos(elapsedTime * 0.5) * 0.1;

    if (groupRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, targetX, 2, delta);
      groupRef.current.rotation.x = THREE.MathUtils.damp(groupRef.current.rotation.x, -targetY, 2, delta);
      const targetZ = isListening ? 0.5 : 0;
      groupRef.current.position.z = THREE.MathUtils.damp(groupRef.current.position.z, targetZ, 3, delta);
    }

    const targetDistort = isListening ? 0.8 + (voiceBoost * 0.5) : 0.1;
    const targetSpeed = isListening ? 6 + (voiceBoost * 2) : 1;
    const basePulse = isListening ? Math.sin(elapsedTime * 8) * 0.04 : Math.sin(elapsedTime * 2) * 0.01;

    const targetOuterScale = (1 + basePulse) + voiceBoost;
    const targetMiddleScale = isListening ? 1.1 + (voiceBoost * 0.5) : 0.95;
    const targetInnerScale = isListening ? 0.8 - (voiceBoost * 0.2) : 0.9;

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
const FRIEND_COLOURS = ['#0a0a0a', '#333333', '#555555', '#878787'];

const FriendsListOverlay = ({ friends, isLoading, isOpen, onClose, onSelectFriend, selectedFriendId }) => {
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
              {isLoading && (
                <div style={{ padding: '24px', textAlign: 'center', color: '#878787', fontSize: '13px' }}>
                  Loading...
                </div>
              )}
              {!isLoading && friends.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: '#878787', fontSize: '13px', lineHeight: 1.6 }}>
                  No connections yet.
                </div>
              )}
              {!isLoading && friends.map((friend, i) => (
                <MagneticButton
                  key={friend.id}
                  hoverScale={1.02}
                  className={`friend-list-item ${selectedFriendId === friend.id ? 'selected' : ''}`}
                  onClick={() => onSelectFriend(friend.id)}
                >
                  <div className="friend-avatar" style={{ backgroundColor: FRIEND_COLOURS[i % FRIEND_COLOURS.length] }} />
                  <span className="friend-name">{friend.username}</span>
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
// interestIds in the DB are ObjectIds, but since there's no /interests endpoint yet
// we just store the interest label strings directly as interestIds for now.
const SetupScreen = ({ onComplete, currentUser }) => {
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [saving, setSaving] = useState(false);
  const interests = ["Architecture", "Minimalism", "Acoustics", "Creative Coding", "Typography", "Web3", "Industrial Design", "Photography"];

  const toggleInterest = (interest) => {
    setSelectedInterests(prev => prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]);
  };

  const handleContinue = async () => {
    // Best-effort save of interests — if it fails we still proceed
    if (currentUser?.id && selectedInterests.length > 0) {
      setSaving(true);
      try {
        await fetch(`${API_BASE}/users/${currentUser.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interestIds: selectedInterests }),
        });
      } catch (err) {
        console.warn('Could not save interests:', err);
      } finally {
        setSaving(false);
      }
    }
    onComplete();
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
        <p>Select your interests to tailor your voice feed.</p>
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
            <MagneticButton className="continue-btn" hoverScale={1.03} onClick={handleContinue}>
              {saving ? 'Saving...' : 'Continue to Echo'}
            </MagneticButton>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// --- 6. Auth Input Field Component ---
const AuthField = ({ label, type = 'text', value, onChange, placeholder, showToggle = false }) => {
  const [visible, setVisible] = useState(false);
  const inputType = showToggle ? (visible ? 'text' : 'password') : type;

  return (
    <motion.div
      className="auth-field"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
    >
      <label className="auth-label">{label}</label>
      <div className="auth-input-wrapper">
        <input
          className="auth-input"
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        {showToggle && (
          <button
            type="button"
            className="auth-eye-btn"
            onClick={() => setVisible(v => !v)}
            tabIndex={-1}
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? <EyeOff size={16} strokeWidth={1.8} /> : <Eye size={16} strokeWidth={1.8} />}
          </button>
        )}
      </div>
    </motion.div>
  );
};

const API_BASE = 'http://127.0.0.1:8000/db';

// --- 7. Login Screen ---
const LoginScreen = ({ onLogin, onGoToRegister }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username) { setError('Please enter your username.'); return; }
    setError('');
    setLoading(true);
    try {
      // Backend has no GET /users?username= filter yet, so fetch all and match
      const res = await fetch(`${API_BASE}/users`);
      if (!res.ok) throw new Error('Could not reach server.');
      const allUsers = await res.json();
      const match = allUsers.find(
        u => u.username.toLowerCase() === username.trim().toLowerCase()
      );
      if (!match) { setError('No account found with that username.'); setLoading(false); return; }
      onLogin(match); // passes full user object { id, username, interestIds, ... }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
    exit: { opacity: 0, x: -40, filter: 'blur(8px)', transition: { duration: 0.35 } }
  };

  return (
    <motion.div
      className="auth-container"
      variants={containerVariants}
      initial="hidden"
      animate="show"
      exit="exit"
    >
      {/* Ambient decorative ring */}
      <div className="auth-ring" aria-hidden />

      <motion.div className="auth-wordmark" variants={{ hidden: { opacity: 0, y: -10 }, show: { opacity: 1, y: 0 } }}>
        E C H O
      </motion.div>

      <motion.div className="auth-card" variants={{ hidden: { opacity: 0, y: 30, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 22 } } }}>
        <div className="auth-card-header">
          <h2 className="auth-title">Welcome back.</h2>
          <p className="auth-sub">Sign in to your Echo space.</p>
        </div>

        <div className="auth-fields">
          <AuthField label="Username" value={username} onChange={e => setUsername(e.target.value)} placeholder="your_username" />
          <AuthField label="Password" showToggle value={password} onChange={e => setPassword(e.target.value)} placeholder="your_password" />
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              className="auth-error"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.button
          className={`auth-submit-btn ${loading ? 'loading' : ''}`}
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <span className="auth-spinner" />
          ) : (
            'Log in'
          )}
        </motion.button>

        <div className="auth-divider">
          <span />
          <p>or</p>
          <span />
        </div>

        <motion.button
          className="auth-secondary-btn"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={onGoToRegister}
        >
          Create an account
        </motion.button>
      </motion.div>

      <motion.p
        className="auth-legal"
        variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { delay: 0.6 } } }}
      >
        By continuing, you agree to our Terms & Privacy Policy.
      </motion.p>
    </motion.div>
  );
};

// --- 8. Register Screen ---
const RegisterScreen = ({ onRegister, onGoToLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState(''); // cosmetic only, not stored
  const [confirm, setConfirm] = useState('');   // cosmetic only, not stored
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim()) { setError('Please enter a username.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          interestIds: [],
          avatarUrl: null,
          voiceId: null,
          createdAt: new Date().toISOString(),
        }),
      });
      if (res.status === 409) { setError('Username already taken.'); setLoading(false); return; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Registration failed.');
      }
      const newUser = await res.json();
      onRegister(newUser);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
    exit: { opacity: 0, x: 40, filter: 'blur(8px)', transition: { duration: 0.35 } }
  };

  return (
    <motion.div
      className="auth-container"
      variants={containerVariants}
      initial="hidden"
      animate="show"
      exit="exit"
    >
      <div className="auth-ring auth-ring--register" aria-hidden />

      <motion.div className="auth-wordmark" variants={{ hidden: { opacity: 0, y: -10 }, show: { opacity: 1, y: 0 } }}>
        E C H O
      </motion.div>

      <motion.div
        className="auth-card"
        variants={{ hidden: { opacity: 0, y: 30, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 22 } } }}
      >
        <div className="auth-card-header">
          <button className="auth-back-btn" onClick={onGoToLogin} aria-label="Back to login">
            <ArrowLeft size={16} strokeWidth={2} />
            <span>Back</span>
          </button>
          <h2 className="auth-title">Join Echo.</h2>
          <p className="auth-sub">Create your account to get started.</p>
        </div>

        <div className="auth-fields">
          <AuthField label="Username" value={username} onChange={e => setUsername(e.target.value)} placeholder="your_username" />
          <AuthField label="Password" showToggle value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters" />
          <AuthField label="Confirm password" showToggle value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" />
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              className="auth-error"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.button
          className={`auth-submit-btn ${loading ? 'loading' : ''}`}
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? <span className="auth-spinner" /> : 'Create account'}
        </motion.button>
      </motion.div>

      <motion.p
        className="auth-legal"
        variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { delay: 0.7 } } }}
      >
        By continuing, you agree to our Terms & Privacy Policy.
      </motion.p>
    </motion.div>
  );
};

// --- 9. Daily Summary Prompt ---
const DailySummaryPrompt = ({ onYes, onNo }) => (
  <AnimatePresence>
    <motion.div
      className="summary-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        className="summary-card"
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28, delay: 0.05 }}
      >
        {/* decorative pulse ring */}
        <div className="summary-ring" aria-hidden />

        <motion.div
          className="summary-icon"
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.15 }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </motion.div>

        <motion.h3
          className="summary-title"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Daily Summary
        </motion.h3>

        <motion.p
          className="summary-body"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.27 }}
        >
          Would you like to hear your daily summary?
        </motion.p>

        <motion.div
          className="summary-actions"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34 }}
        >
          <motion.button
            className="summary-btn summary-btn--yes"
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.96 }}
            onClick={onYes}
          >
            Yes, play it
          </motion.button>
          <motion.button
            className="summary-btn summary-btn--no"
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.96 }}
            onClick={onNo}
          >
            Not now
          </motion.button>
        </motion.div>
      </motion.div>
    </motion.div>
  </AnimatePresence>
);

// --- 10. Main Application Component ---
const App = () => {
  // appState: 'booting' | 'login' | 'register' | 'setup' | 'main'
  const [appState, setAppState] = useState('booting');
  const [currentUser, setCurrentUser] = useState(null); // full user object from DB { id, username, ... }
  const [showSummaryPrompt, setShowSummaryPrompt] = useState(false);
  const [activeTab, setActiveTab] = useState('voice');
  const [isFriendsListOpen, setIsFriendsListOpen] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState(null);
  const [transcript, setTranscript] = useState("");

  // Friends loaded from API after login
  const [friends, setFriends] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(false);

  const fetchFriends = useCallback(async (username) => {
    if (!username) return;
    setFriendsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/users/${encodeURIComponent(username)}/friends`);
      if (!res.ok) throw new Error('Failed to load friends');
      const data = await res.json();
      setFriends(data);
    } catch (err) {
      console.error('Friends fetch error:', err);
      setFriends([]);
    } finally {
      setFriendsLoading(false);
    }
  }, []);

  // Login: go to main then show summary prompt, load friends
  const handleLogin = (user) => {
    setCurrentUser(user);
    setAppState('main');
    setShowSummaryPrompt(true);
    fetchFriends(user.username);
  };

  // Register: show setup first; summary prompt shown after setup completes
  const handleRegister = (user) => {
    setCurrentUser(user);
    setAppState('setup');
    // New users have no friends yet, no need to fetch
    setFriends([]);
  };

  // Build graph data from real friends list
  const graphData = useMemo(() => {
    if (friends.length === 0) return { nodes: [], links: [] };
    const colours = ['#0a0a0a', '#333333', '#555555', '#878787'];
    const nodes = friends.map((friend, i) => ({
      id: friend.id,
      name: friend.username,
      val: 1.5,
      colour: colours[i % colours.length],
    }));
    // Create links between friends who share interests (simple heuristic for visualisation)
    const links = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (Math.random() > 0.6) {
          links.push({ source: nodes[i].id, target: nodes[j].id });
        }
      }
    }
    return { nodes, links };
  }, [friends]);

  useEffect(() => {
    const timer = setTimeout(() => setAppState('login'), 2500);
    return () => clearTimeout(timer);
  }, []);

  const conversation = useConversation({
    onMessage: (message) => {
      if (message.text) setTranscript(message.text);
    },
    onError: (error) => console.error('ElevenLabs SDK Error:', error),
  });

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const isListening = conversation.status === 'connected';

  const toggleListening = useCallback(async () => {
    if (isListening) {
      await conversation.endSession();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } else {
      try {
        const response = await fetch('http://127.0.0.1:8000/envs/elevenlabs');
        if (!response.ok) { const errData = await response.json(); throw new Error(errData.detail || "Backend failed"); }
        const data = await response.json();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          try {
            const formData = new FormData();
            formData.append('file', audioBlob, 'recording.webm');
            formData.append('model_id', 'scribe_v1');
            const sttResponse = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
              method: 'POST',
              headers: { 'xi-api-key': import.meta.env.VITE_ELEVENLABS_API_KEY },
              body: formData,
            });
            if (!sttResponse.ok) { const errData = await sttResponse.json(); throw new Error("STT request failed"); }
            const sttData = await sttResponse.json();
            setTranscript(sttData.text);
          } catch (err) { console.error("Transcription error:", err); }
        };
        mediaRecorder.start();
        await conversation.startSession({ signedUrl: data.signedUrl });
      } catch (err) {
        console.error("Voice session failed:", err);
        alert(`Error: ${err.message}`);
      }
    }
  }, [isListening, conversation]);

  const handleSelectFriendFromList = (id) => {
    setActiveTab('friends');
    setSelectedFriendId(id);
    setIsFriendsListOpen(false);
  };

  const handleNodeClick = useCallback((node) => { setSelectedFriendId(node.id); }, []);

  // Refresh friends list (e.g. after adding a new friend)
  const handleRefreshFriends = useCallback(() => {
    if (currentUser?.username) fetchFriends(currentUser.username);
  }, [currentUser, fetchFriends]);

  const handleLogout = () => {
    setCurrentUser(null);
    setFriends([]);
    setTranscript('');
    setActiveTab('voice');
    setIsFriendsListOpen(false);
    setSelectedFriendId(null);
    setShowSummaryPrompt(false);
    if (isListening) conversation.endSession();
    setAppState('login');
  };

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap');

    :root {
      --bg-colour: #fafafa;
      --text-primary: #0a0a0a;
      --text-secondary: #878787;
      --panel-bg: rgba(255, 255, 255, 0.85);
      --border: rgba(0,0,0,0.07);
      --transition-smooth: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }

    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

    .app-wrapper {
      position: relative; height: 100vh; height: 100dvh;
      width: 100vw; background-color: var(--text-primary);
      overflow: hidden; font-family: 'DM Sans', -apple-system, sans-serif;
    }

    /* ── Loading ── */
    .loading-screen {
      position: absolute; inset: 0; display: flex; justify-content: center; align-items: center;
      background-color: var(--text-primary); color: var(--bg-colour); z-index: 100;
    }
    .loading-text { font-size: 24px; font-weight: 800; letter-spacing: 0.4em; }

    /* ── Main shell ── */
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
    .header-icon:hover { background: rgba(255,255,255,0.9); box-shadow: 0 4px 12px rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.1); }
    .logo-text { font-size: 14px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; margin: 0; pointer-events: auto; cursor: pointer; transition: opacity 0.3s ease; }
    .logo-text:hover { opacity: 0.7; }


    .content-area { flex: 1; position: relative; }
    .canvas-wrapper { position: absolute; inset: 0; z-index: 1; cursor: pointer; }
    .graph-container { position: absolute; inset: 0; z-index: 2; cursor: grab; }
    .graph-container:active { cursor: grabbing; }

    .interaction-overlay {
      position: absolute; top: calc(20% + env(safe-area-inset-top));
      left: 50%; transform: translateX(-50%);
      display: flex; flex-direction: column; align-items: center;
      pointer-events: none; z-index: 5;
      width: 80%; max-width: 600px;
    }

    .status-badge {
      padding: 8px 16px; border-radius: 24px; font-size: 11px; font-weight: 600; letter-spacing: 0.08em;
      text-transform: uppercase; background-color: rgba(255, 255, 255, 0.6);
      border: 1px solid rgba(255,255,255,0.8); box-shadow: 0 4px 12px rgba(0,0,0,0.03);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    }

    .transcript-container { margin-top: 32px; text-align: center; }
    .transcript-text { font-size: 20px; font-weight: 500; color: var(--text-primary); line-height: 1.4; letter-spacing: -0.01em; margin: 0; text-shadow: 0 2px 10px rgba(255,255,255,0.8); }

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
      padding: 8px 16px; background: rgba(255,255,255,0.8); gap: 16px;
      backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255,255,255,0.9); border-radius: 40px;
      box-shadow: 0 16px 40px rgba(0,0,0,0.08); width: auto;
      transition: var(--transition-smooth);
    }
    .bottom-nav:hover { box-shadow: 0 20px 48px rgba(0,0,0,0.12); border-color: rgba(255,255,255,1); }

    .nav-item {
      position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;
      cursor: pointer; color: var(--text-secondary); width: 48px; height: 48px; transition: var(--transition-smooth);
      border-radius: 50%; outline: none; border: none; background: transparent; -webkit-touch-callout: none;
    }
    .nav-item:hover { color: var(--text-primary); transform: translateY(-2px); }
    .nav-item.active { color: var(--text-primary); }
    .active-indicator { position: absolute; bottom: 4px; width: 5px; height: 5px; background-color: var(--text-primary); border-radius: 50%; }

    /* ── Friends overlay ── */
    .friends-overlay-backdrop { position: absolute; inset: 0; background: rgba(250,250,250,0.4); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 40; }
    .friends-list-panel {
      position: absolute; top: 0; left: 0; bottom: 0; width: 100%; max-width: 380px;
      background: var(--panel-bg); backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px);
      border-right: 1px solid rgba(0,0,0,0.05); z-index: 50; display: flex; flex-direction: column;
      box-shadow: 20px 0 40px rgba(0,0,0,0.05); padding-top: max(24px, env(safe-area-inset-top));
    }
    .friends-list-header { display: flex; justify-content: space-between; align-items: center; padding: 0 24px 20px 24px; border-bottom: 1px solid rgba(0,0,0,0.05); }
    .friends-list-header h3 { font-size: 18px; font-weight: 700; margin: 0; letter-spacing: -0.02em; }
    .close-btn { background: transparent; border: none; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; padding: 4px; border-radius: 50%; transition: var(--transition-smooth); }
    .close-btn:hover { color: var(--text-primary); transform: rotate(90deg); background: rgba(0,0,0,0.05); }
    .friends-scroll-area { flex: 1; overflow-y: auto; padding: 12px; }
    .friends-scroll-area::-webkit-scrollbar { display: none; }
    .friend-list-item { width: 100%; display: flex; align-items: center; gap: 16px; padding: 16px 12px; background: transparent; border: none; border-radius: 16px; cursor: pointer; text-align: left; transition: var(--transition-smooth); }
    .friend-list-item:hover { background: rgba(0,0,0,0.03); transform: translateX(4px); }
    .friend-list-item.selected { background: rgba(0,0,0,0.06); box-shadow: inset 2px 0 0 0 var(--text-primary); }
    .friend-avatar { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2); transition: var(--transition-smooth); }
    .friend-list-item:hover .friend-avatar { transform: scale(1.08); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .friend-name { font-size: 15px; font-weight: 600; color: var(--text-primary); flex: 1; transition: var(--transition-smooth); }
    .friend-list-item:hover .friend-name { transform: translateX(2px); }
    .chevron-wrapper { display: flex; align-items: center; justify-content: center; transition: var(--transition-smooth); }
    .friend-chevron { color: var(--text-secondary); opacity: 0.5; transition: var(--transition-smooth); }
    .friend-list-item:hover .chevron-wrapper { transform: translateX(2px); }
    .friend-list-item:hover .friend-chevron { opacity: 1; color: var(--text-primary); }

    /* ── Setup screen ── */
    .setup-container {
      position: absolute; inset: 0; z-index: 30; background: var(--bg-colour);
      display: flex; flex-direction: column; padding: max(120px, env(safe-area-inset-top)) 32px 40px 32px;
    }
    .setup-header { margin-bottom: 40px; }
    .setup-header h2 { font-size: 32px; font-weight: 800; margin: 0 0 12px 0; letter-spacing: -0.03em; }
    .setup-header p { font-size: 16px; color: var(--text-secondary); line-height: 1.5; margin: 0; max-width: 300px; }
    .interests-grid { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: auto; }
    .interest-pill { padding: 12px 20px; border-radius: 30px; border: 1px solid #eaeaea; background: transparent; font-size: 14px; font-weight: 500; cursor: pointer; transition: var(--transition-smooth); color: var(--text-secondary); }
    .interest-pill:hover:not(.selected) { border-color: #ccc; background: rgba(0,0,0,0.02); color: var(--text-primary); }
    .interest-pill.selected { background: var(--text-primary); color: var(--bg-colour); border-color: var(--text-primary); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .setup-footer { display: flex; justify-content: center; width: 100%; padding-top: 24px; }
    .continue-btn { background: var(--text-primary); color: var(--bg-colour); border: none; border-radius: 30px; padding: 16px 32px; font-size: 15px; font-weight: 600; cursor: pointer; width: 100%; max-width: 300px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); transition: var(--transition-smooth); }
    .continue-btn:hover { box-shadow: 0 12px 32px rgba(0,0,0,0.25); background: #1a1a1a; transform: translateY(-2px); }

    /* ── Auth screens ── */
    .auth-container {
      position: absolute; inset: 0; z-index: 30;
      background: var(--bg-colour);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: max(40px, env(safe-area-inset-top)) 24px max(32px, env(safe-area-inset-bottom)) 24px;
      overflow-y: auto; overflow-x: hidden;
    }

    /* Decorative ambient ring behind the card */
    .auth-ring {
      position: absolute;
      width: 520px; height: 520px;
      border-radius: 50%;
      border: 1px solid rgba(0,0,0,0.06);
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      animation: authRingPulse 6s ease-in-out infinite;
    }
    .auth-ring::before {
      content: '';
      position: absolute;
      inset: 40px;
      border-radius: 50%;
      border: 1px solid rgba(0,0,0,0.04);
      animation: authRingPulse 6s ease-in-out infinite 1.5s;
    }
    .auth-ring::after {
      content: '';
      position: absolute;
      inset: 90px;
      border-radius: 50%;
      border: 1px solid rgba(0,0,0,0.03);
      animation: authRingPulse 6s ease-in-out infinite 3s;
    }
    .auth-ring--register { animation-delay: -2s; }

    @keyframes authRingPulse {
      0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      50% { transform: translate(-50%, -50%) scale(1.04); opacity: 0.6; }
    }

    .auth-wordmark {
      font-size: 13px; font-weight: 800; letter-spacing: 0.35em;
      color: var(--text-primary); margin-bottom: 32px;
      position: relative; z-index: 2;
    }

    .auth-card {
      width: 100%; max-width: 400px;
      background: rgba(255,255,255,0.9);
      backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(0,0,0,0.07);
      border-radius: 24px;
      padding: 32px;
      box-shadow: 0 8px 48px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
      position: relative; z-index: 2;
    }

    .auth-card-header { margin-bottom: 28px; }
    .auth-title { font-size: 26px; font-weight: 800; letter-spacing: -0.03em; margin: 0 0 6px 0; color: var(--text-primary); }
    .auth-sub { font-size: 14px; color: var(--text-secondary); margin: 0; }

    .auth-back-btn {
      display: inline-flex; align-items: center; gap: 6px;
      background: transparent; border: none; padding: 0 0 16px 0;
      color: var(--text-secondary); font-size: 13px; font-weight: 500;
      cursor: pointer; transition: color 0.2s ease;
    }
    .auth-back-btn:hover { color: var(--text-primary); }

    .auth-fields { display: flex; flex-direction: column; gap: 16px; margin-bottom: 8px; }

    .auth-field { display: flex; flex-direction: column; gap: 7px; }
    .auth-label { font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-secondary); }

    .auth-input-wrapper { position: relative; }
    .auth-input {
      width: 100%; padding: 13px 16px;
      background: rgba(0,0,0,0.03);
      border: 1px solid rgba(0,0,0,0.08);
      border-radius: 12px;
      font-size: 15px; font-weight: 400;
      color: var(--text-primary);
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    }
    .auth-input::placeholder { color: #bbb; }
    .auth-input:focus {
      border-color: rgba(0,0,0,0.2);
      background: #fff;
      box-shadow: 0 0 0 3px rgba(0,0,0,0.04);
    }

    .auth-eye-btn {
      position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
      background: transparent; border: none; color: var(--text-secondary);
      cursor: pointer; display: flex; align-items: center; padding: 4px;
      border-radius: 6px; transition: color 0.2s ease;
    }
    .auth-eye-btn:hover { color: var(--text-primary); }

    .auth-error {
      font-size: 13px; color: #c0392b; font-weight: 500;
      margin: 8px 0 4px 0; padding: 10px 14px;
      background: rgba(192,57,43,0.06); border-radius: 10px;
      border: 1px solid rgba(192,57,43,0.12);
    }

    .auth-submit-btn {
      width: 100%; margin-top: 20px; padding: 15px;
      background: var(--text-primary); color: var(--bg-colour);
      border: none; border-radius: 14px;
      font-size: 15px; font-weight: 700; font-family: inherit;
      cursor: pointer; letter-spacing: 0.01em;
      box-shadow: 0 6px 20px rgba(0,0,0,0.14);
      transition: background 0.2s ease, box-shadow 0.25s ease, transform 0.15s ease;
      display: flex; align-items: center; justify-content: center; min-height: 52px;
    }
    .auth-submit-btn:hover { background: #1a1a1a; box-shadow: 0 10px 28px rgba(0,0,0,0.2); }
    .auth-submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }

    .auth-spinner {
      width: 18px; height: 18px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      animation: spin 0.7s linear infinite;
      display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .auth-divider {
      display: flex; align-items: center; gap: 12px;
      margin: 20px 0 4px;
    }
    .auth-divider span { flex: 1; height: 1px; background: rgba(0,0,0,0.07); }
    .auth-divider p { font-size: 12px; color: var(--text-secondary); font-weight: 500; margin: 0; }

    .auth-secondary-btn {
      width: 100%; margin-top: 12px; padding: 14px;
      background: transparent; color: var(--text-primary);
      border: 1px solid rgba(0,0,0,0.1); border-radius: 14px;
      font-size: 15px; font-weight: 600; font-family: inherit;
      cursor: pointer; transition: background 0.2s ease, border-color 0.2s ease;
    }
    .auth-secondary-btn:hover { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.18); }

    .auth-legal {
      font-size: 11px; color: var(--text-secondary); text-align: center;
      margin-top: 24px; max-width: 280px; line-height: 1.6;
      position: relative; z-index: 2;
    }

    /* ── Daily Summary Prompt ── */
    .summary-backdrop {
      position: absolute; inset: 0; z-index: 60;
      display: flex; align-items: flex-end; justify-content: center;
      padding-bottom: max(120px, calc(env(safe-area-inset-bottom) + 100px));
      background: rgba(250, 250, 250, 0.5);
      backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
      pointer-events: all;
    }

    .summary-card {
      position: relative; overflow: hidden;
      width: calc(100% - 48px); max-width: 360px;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px);
      border: 1px solid rgba(0, 0, 0, 0.07);
      border-radius: 28px;
      padding: 32px 28px 28px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.04);
      display: flex; flex-direction: column; align-items: center;
      text-align: center; gap: 0;
    }

    .summary-ring {
      position: absolute; top: -60px; right: -60px;
      width: 180px; height: 180px; border-radius: 50%;
      border: 1px solid rgba(0,0,0,0.05);
      pointer-events: none;
    }
    .summary-ring::before {
      content: ''; position: absolute; inset: 24px;
      border-radius: 50%; border: 1px solid rgba(0,0,0,0.04);
    }

    .summary-icon {
      width: 52px; height: 52px; border-radius: 50%;
      background: var(--text-primary);
      color: var(--bg-colour);
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 18px;
      box-shadow: 0 8px 20px rgba(0,0,0,0.16);
    }

    .summary-title {
      font-size: 18px; font-weight: 800; letter-spacing: -0.025em;
      color: var(--text-primary); margin: 0 0 8px 0;
    }

    .summary-body {
      font-size: 14px; color: var(--text-secondary);
      line-height: 1.55; margin: 0 0 24px 0; max-width: 240px;
    }

    .summary-actions {
      display: flex; flex-direction: column; gap: 10px; width: 100%;
    }

    .summary-btn {
      width: 100%; padding: 14px;
      border-radius: 14px; font-size: 15px; font-weight: 600;
      font-family: inherit; cursor: pointer;
      border: none; transition: box-shadow 0.2s ease, background 0.2s ease;
    }

    .summary-btn--yes {
      background: var(--text-primary); color: var(--bg-colour);
      box-shadow: 0 6px 18px rgba(0,0,0,0.14);
    }
    .summary-btn--yes:hover { background: #1a1a1a; box-shadow: 0 10px 24px rgba(0,0,0,0.22); }

    .summary-btn--no {
      background: transparent; color: var(--text-secondary);
      border: 1px solid rgba(0,0,0,0.08);
    }
    .summary-btn--no:hover { background: rgba(0,0,0,0.03); color: var(--text-primary); border-color: rgba(0,0,0,0.14); }
  `;

  return (
    <>
      <style>{styles}</style>
      <div className="app-wrapper">
        {/* Boot splash */}
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

          {/* Auth pages live outside the header/nav shell */}
          <AnimatePresence mode="wait">
            {appState === 'login' && (
              <LoginScreen
                key="login"
                onLogin={handleLogin}
                onGoToRegister={() => setAppState('register')}
              />
            )}
            {appState === 'register' && (
              <RegisterScreen
                key="register"
                onRegister={handleRegister}
                onGoToLogin={() => setAppState('login')}
              />
            )}
          </AnimatePresence>

          {/* App chrome — only shown post-auth */}
          {(appState === 'setup' || appState === 'main') && (
            <>
              <header className="top-header">
                <MagneticButton
                  className="header-icon"
                  ariaLabel="Menu"
                  hoverScale={1.1}
                  onClick={() => setIsFriendsListOpen(true)}
                >
                  <Menu size={20} color="var(--text-primary)" strokeWidth={1.5} />
                </MagneticButton>
                <motion.h1 className="logo-text" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}>
                  {currentUser ? currentUser.username : 'Echo'}
                </motion.h1>
                <MagneticButton
                  className="header-icon"
                  ariaLabel="Log out"
                  hoverScale={1.1}
                  onClick={handleLogout}
                >
                  <LogOut size={18} color="var(--text-primary)" strokeWidth={1.5} />
                </MagneticButton>
              </header>

              <main className="content-area">
                {/* Background 3D canvas */}
                <div className="canvas-wrapper" onClick={appState === 'main' && activeTab === 'voice' ? toggleListening : undefined}>
                  <Canvas camera={{ position: [0, 0, 5], fov: 40 }} dpr={[1, Math.min(2, window.devicePixelRatio)]}>
                    <color attach="background" args={['#fafafa']} />
                    <Suspense fallback={<CanvasLoader />}>
                      <ambientLight intensity={1} />
                      <directionalLight position={[5, 5, 5]} intensity={2} />
                      <directionalLight position={[-5, -5, -2]} intensity={1} />
                      <Environment preset="studio" />
                      {activeTab === 'voice' && (
                        <ReactiveAudioRing isListening={isListening} volume={conversation.inputVolume} />
                      )}
                      <EffectComposer disableNormalPass>
                        <Vignette eskil={false} offset={0.1} darkness={0.4} />
                      </EffectComposer>
                    </Suspense>
                  </Canvas>
                </div>

                <AnimatePresence mode="wait">
                  {appState === 'setup' && <SetupScreen key="setup" currentUser={currentUser} onComplete={() => { setAppState('main'); setShowSummaryPrompt(true); }} />}

                  {appState === 'main' && activeTab === 'friends' && (
                    <FriendsGraph key="friends-graph" graphData={graphData} selectedNodeId={selectedFriendId} onNodeClick={handleNodeClick} />
                  )}

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

                      <AnimatePresence>
                        {transcript && (
                          <motion.div
                            key="transcript-view"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="transcript-container"
                          >
                            <p className="transcript-text">"{transcript}"</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </AnimatePresence>

                <FriendsListOverlay
                  friends={friends}
                  isLoading={friendsLoading}
                  isOpen={isFriendsListOpen}
                  onClose={() => setIsFriendsListOpen(false)}
                  onSelectFriend={handleSelectFriendFromList}
                  selectedFriendId={selectedFriendId}
                />

                {/* Daily summary prompt — floats above everything */}
                {showSummaryPrompt && (
                  <DailySummaryPrompt
                    onYes={() => setShowSummaryPrompt(false)}
                    onNo={() => setShowSummaryPrompt(false)}
                  />
                )}
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
                      <MagneticButton isActive={activeTab === 'voice'} className="nav-item" ariaLabel="Voice Hub" hoverScale={1.15} onClick={() => setActiveTab('voice')}>
                        <Mic size={22} strokeWidth={2} />
                        {activeTab === 'voice' && <motion.div layoutId="activeTabIndicator" className="active-indicator" initial={false} transition={{ type: "spring", stiffness: 400, damping: 25 }} />}
                      </MagneticButton>

                      <MagneticButton isActive={activeTab === 'friends'} className="nav-item" ariaLabel="Friends Network" hoverScale={1.15} onClick={() => { setActiveTab('friends'); if (isListening) toggleListening(); }}>
                        <Users size={22} strokeWidth={2} />
                        {activeTab === 'friends' && <motion.div layoutId="activeTabIndicator" className="active-indicator" initial={false} transition={{ type: "spring", stiffness: 400, damping: 25 }} />}
                      </MagneticButton>

                      <MagneticButton isActive={activeTab === 'forum'} className="nav-item" ariaLabel="Community Forum" hoverScale={1.15} onClick={() => { setActiveTab('forum'); if (isListening) toggleListening(); }}>
                        <MessageSquare size={22} strokeWidth={2} />
                        {activeTab === 'forum' && <motion.div layoutId="activeTabIndicator" className="active-indicator" initial={false} transition={{ type: "spring", stiffness: 400, damping: 25 }} />}
                      </MagneticButton>
                    </nav>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default App;