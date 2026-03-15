import * as THREE from 'three';
import React, { useState, useRef, Suspense, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { Torus, Sparkles, MeshDistortMaterial, Float, Environment, Html } from '@react-three/drei';
import { EffectComposer, Vignette } from '@react-three/postprocessing';
import { Mic, Menu, Users, X, ChevronRight, MessageSquare, ArrowLeft, Eye, EyeOff, LogOut, Search, UserPlus, Check, Clock, UserCheck, User } from 'lucide-react';
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
  const fgRef = useRef();
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (fgRef.current) {
      setTimeout(() => fgRef.current?.zoomToFit(800, 100), 1000);
    }
  }, [graphData]);

  useEffect(() => {
    if (selectedNodeId !== null && fgRef.current && graphData.nodes.length) {
      const node = graphData.nodes.find(n => n.id === selectedNodeId);
      if (node && node.x !== undefined) {
        const distance = 60;
        fgRef.current.cameraPosition(
          { x: node.x + distance, y: node.y + distance, z: node.z + distance },
          node,
          1800
        );
      }
    }
  }, [selectedNodeId, graphData]);

  const nodeThreeObject = useCallback((node) => {
    const group = new THREE.Group();
  
    const geo = new THREE.IcosahedronGeometry(node.isMe ? 5 : 3.5, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: node.id === selectedNodeId ? '#ffffff' : node.colour,
      roughness: 0.25,
      metalness: 0.7,
      flatShading: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);
  
    return group;
  }, [selectedNodeId]);

  return (
    <motion.div
      className="graph-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      // Ensure pointer events are never swallowed by the motion wrapper
      style={{ pointerEvents: 'all', touchAction: 'none' }}
    >
      <ForceGraph3D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        backgroundColor="rgba(0,0,0,0)"
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        linkWidth={0.8}
        linkColor={() => 'rgba(120, 120, 120, 0.2)'}
        linkOpacity={0.4}
        linkCurvature={0}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        enablePointerInteraction={true}
        showNavInfo={false}
        onNodeClick={onNodeClick}
        // Smooth, floaty physics
        d3AlphaDecay={0.01}
        d3VelocityDecay={0.1}
        warmupTicks={60}
        cooldownTicks={200}
        cooldownTime={4000}
      />
    </motion.div>
  );
};

// --- 4. User Search & Add Friend Panel (inline in friends overlay) ---
const FRIEND_COLOURS = ['#0a0a0a', '#333333', '#555555', '#878787'];

const UserSearchSection = ({ currentUser, friends, onFriendAdded }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  // Map of username -> 'sent' | 'error'
  const [requestStates, setRequestStates] = useState({});
  const [error, setError] = useState('');
  const debounceRef = useRef(null);

  const existingFriendUsernames = useMemo(() => new Set(friends.map(f => f.username)), [friends]);

  const handleSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/users`);
      if (!res.ok) throw new Error('Search failed');
      const all = await res.json();
      const filtered = all.filter(u =>
        u.username.toLowerCase().includes(q.toLowerCase()) &&
        u.username !== currentUser?.username
      );
      setResults(filtered);
    } catch (err) {
      setError('Could not search users.');
    } finally {
      setSearching(false);
    }
  }, [currentUser]);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSearch(val), 350);
  };

  const handleAddFriend = async (targetUser) => {
    if (!currentUser?.username) return;
    // Optimistic
    setRequestStates(prev => ({ ...prev, [targetUser.username]: 'sent' }));
    try {
      const res = await fetch(`${API_BASE}/friendships/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestingUsername: currentUser.username,
          incomingUsername: targetUser.username,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // Already friends or request exists — still show as sent
        if (res.status !== 409) throw new Error(data.detail || 'Request failed');
      }
    } catch (err) {
      console.warn('Could not send friend request:', err);
      setRequestStates(prev => ({ ...prev, [targetUser.username]: 'error' }));
    }
  };

  return (
    <div className="search-section">
      <div className="search-input-wrapper">
        <Search size={14} className="search-icon" strokeWidth={2} />
        <input
          className="search-input"
          type="text"
          value={query}
          onChange={handleQueryChange}
          placeholder="Find people..."
          autoComplete="off"
          spellCheck={false}
        />
        <AnimatePresence>
          {query && (
            <motion.button
              className="search-clear-btn"
              onClick={() => { setQuery(''); setResults([]); }}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.15 }}
            >
              <X size={12} strokeWidth={2.5} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {searching && (
          <motion.div className="search-status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <span className="search-spinner" />
            <span>Searching...</span>
          </motion.div>
        )}
        {error && !searching && (
          <motion.p className="search-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {error}
          </motion.p>
        )}
        {!searching && results.length > 0 && (
          <motion.div
            className="search-results"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            {results.map((user, i) => {
              const alreadyFriend = existingFriendUsernames.has(user.username);
              const state = requestStates[user.username];
              return (
                <motion.div
                  key={user.id}
                  className="search-result-item"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <div
                    className="friend-avatar"
                    style={{ backgroundColor: FRIEND_COLOURS[i % FRIEND_COLOURS.length], width: 32, height: 32, flexShrink: 0 }}
                  />
                  <span className="search-result-name">{user.username}</span>
                  {alreadyFriend ? (
                    <span className="search-result-badge badge--connected">
                      <UserCheck size={12} strokeWidth={2} />
                      <span>Connected</span>
                    </span>
                  ) : state === 'sent' ? (
                    <span className="search-result-badge badge--sent">
                      <Clock size={12} strokeWidth={2} />
                      <span>Sent</span>
                    </span>
                  ) : state === 'error' ? (
                    <span className="search-result-badge badge--error">
                      <X size={12} strokeWidth={2} />
                      <span>Failed</span>
                    </span>
                  ) : (
                    <motion.button
                      className="add-friend-btn"
                      whileHover={{ scale: 1.06, y: -1 }}
                      whileTap={{ scale: 0.93 }}
                      onClick={() => handleAddFriend(user)}
                    >
                      <UserPlus size={13} strokeWidth={2} />
                      <span>Add</span>
                    </motion.button>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
        {!searching && query.trim() && results.length === 0 && !error && (
          <motion.p className="search-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            No users found for "{query}"
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- 5. Incoming Friend Requests Section ---
const IncomingRequestsSection = ({ currentUser, onAccept }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  // Map of friendshipId -> 'accepted' | 'declined'
  const [resolvedIds, setResolvedIds] = useState({});

  const fetchRequests = useCallback(async () => {
    if (!currentUser?.username) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/friendships/pending?incomingUsername=${encodeURIComponent(currentUser.username)}`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRequests(data);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleAccept = async (req) => {
    // Optimistic
    setResolvedIds(prev => ({ ...prev, [req.id]: 'accepted' }));
    try {
      const res = await fetch(`${API_BASE}/friendships/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestingUsername: req.requestingUsername,
          incomingUsername: currentUser.username,
        }),
      });
      if (!res.ok) throw new Error();
      // Friendship now accepted in DB — refresh the friends list so graph updates
      onAccept?.();
    } catch (err) {
      console.warn('Accept request failed:', err);
      setResolvedIds(prev => ({ ...prev, [req.id]: undefined }));
    }
  };

  const handleDecline = async (req) => {
    setResolvedIds(prev => ({ ...prev, [req.id]: 'declined' }));
    try {
      await fetch(`${API_BASE}/friendships/deny`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestingUsername: req.requestingUsername,
          incomingUsername: currentUser.username,
        }),
      });
    } catch (err) {
      console.warn('Decline request failed:', err);
      setResolvedIds(prev => ({ ...prev, [req.id]: undefined }));
    }
  };

  const visibleRequests = requests.filter(r => resolvedIds[r.id] !== 'declined');
  const pendingCount = visibleRequests.filter(r => !resolvedIds[r.id]).length;

  if (loading) return (
    <div className="requests-section">
      <div className="section-label">Requests</div>
      <div style={{ padding: '12px', textAlign: 'center', color: '#878787', fontSize: '12px' }}>Loading...</div>
    </div>
  );

  if (visibleRequests.length === 0) return null;

  return (
    <div className="requests-section">
      <div className="section-label">
        Requests
        {pendingCount > 0 && <span className="requests-badge">{pendingCount}</span>}
      </div>
      <AnimatePresence initial={false}>
        {visibleRequests.map((req, i) => {
          const accepted = resolvedIds[req.id] === 'accepted';
          return (
            <motion.div
              key={req.id}
              className={`request-item ${accepted ? 'request-item--accepted' : ''}`}
              initial={{ opacity: 0, x: -12, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0, x: 12, height: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              <div
                className="friend-avatar"
                style={{ backgroundColor: FRIEND_COLOURS[i % FRIEND_COLOURS.length], width: 34, height: 34, flexShrink: 0 }}
              />
              <div className="request-info">
                <span className="request-name">{req.requestingUsername}</span>
                <span className="request-sub">wants to connect</span>
              </div>
              {accepted ? (
                <motion.span
                  className="search-result-badge badge--connected"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                >
                  <Check size={12} strokeWidth={2.5} />
                  <span>Added</span>
                </motion.span>
              ) : (
                <div className="request-actions">
                  <motion.button
                    className="request-btn request-btn--accept"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => handleAccept(req)}
                  >
                    <Check size={13} strokeWidth={2.5} />
                  </motion.button>
                  <motion.button
                    className="request-btn request-btn--decline"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => handleDecline(req)}
                  >
                    <X size={13} strokeWidth={2.5} />
                  </motion.button>
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

// --- 6. Floating Friends List Overlay ---
const FriendsListOverlay = ({ friends, isLoading, isOpen, onClose, onSelectFriend, selectedFriendId, currentUser, onFriendAdded }) => {
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

            {/* Search for users to add */}
            <UserSearchSection
              currentUser={currentUser}
              friends={friends}
              onFriendAdded={onFriendAdded}
            />

            <div className="friends-scroll-area">
              {/* Incoming friend requests */}
              <IncomingRequestsSection
                currentUser={currentUser}
                onAccept={onFriendAdded}
              />

              {/* Existing connections */}
              {(friends.length > 0 || isLoading) && (
                <div className="section-label" style={{ marginTop: '8px' }}>Connected</div>
              )}

              {isLoading && (
                <div style={{ padding: '16px', textAlign: 'center', color: '#878787', fontSize: '13px' }}>
                  Loading...
                </div>
              )}
              {!isLoading && friends.length === 0 && (
                <div style={{ padding: '16px 12px', color: '#878787', fontSize: '13px', lineHeight: 1.6 }}>
                  No connections yet — search above to find people.
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

// --- 7. Setup Screen Component ---
const SetupScreen = ({ onComplete, currentUser }) => {
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [availableInterests, setAvailableInterests] = useState([]);
  const [loadingInterests, setLoadingInterests] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Fetch interests from DB on mount
  useEffect(() => {
    const fetchInterests = async () => {
      setLoadingInterests(true);
      try {
        const res = await fetch(`${API_BASE}/interests`);
        if (!res.ok) throw new Error('Failed to load interests');
        const data = await res.json();
        setAvailableInterests(data);
      } catch (err) {
        setError('Could not load interests. Please try again.');
      } finally {
        setLoadingInterests(false);
      }
    };
    fetchInterests();
  }, []);

  const toggleInterest = (interestName) => {
    setSelectedInterests(prev =>
      prev.includes(interestName)
        ? prev.filter(n => n !== interestName)
        : [...prev, interestName]
    );
  };

  const handleContinue = async () => {
    if (!currentUser?.username || selectedInterests.length === 0) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/users/${encodeURIComponent(currentUser.username)}/interests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interestNames: selectedInterests }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to save interests');
      }
    } catch (err) {
      console.warn('Could not save interests:', err);
      setError(err.message || 'Something went wrong.');
    } finally {
      setSaving(false);
      onComplete();
    }
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

      {loadingInterests ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#878787', fontSize: 14 }}>
          <span className="auth-spinner" style={{ borderTopColor: '#878787', borderColor: 'rgba(0,0,0,0.1)' }} />
          Loading interests...
        </div>
      ) : error && availableInterests.length === 0 ? (
        <p style={{ color: '#c0392b', fontSize: 14 }}>{error}</p>
      ) : (
        <div className="interests-grid">
          {availableInterests.map(interest => (
            <motion.button
              key={interest.id}
              variants={itemVariants}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleInterest(interest.name)}
              className={`interest-pill ${selectedInterests.includes(interest.name) ? 'selected' : ''}`}
            >
              {interest.name}
            </motion.button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {error && availableInterests.length > 0 && (
          <motion.p className="auth-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {error}
          </motion.p>
        )}
        {selectedInterests.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="setup-footer">
            <MagneticButton className="continue-btn" hoverScale={1.03} onClick={handleContinue}>
              {saving ? 'Saving...' : `Continue to Echo (${selectedInterests.length} selected)`}
            </MagneticButton>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// --- 8. Auth Input Field Component ---
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

// --- 9. Login Screen ---
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
      const res = await fetch(`${API_BASE}/users`);
      if (!res.ok) throw new Error('Could not reach server.');
      const allUsers = await res.json();
      const match = allUsers.find(
        u => u.username.toLowerCase() === username.trim().toLowerCase()
      );
      if (!match) { setError('No account found with that username.'); setLoading(false); return; }
      onLogin(match);
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
    <motion.div className="auth-container" variants={containerVariants} initial="hidden" animate="show" exit="exit">
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
            <motion.p className="auth-error" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
              {error}
            </motion.p>
          )}
        </AnimatePresence>
        <motion.button className={`auth-submit-btn ${loading ? 'loading' : ''}`} whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }} onClick={handleSubmit} disabled={loading}>
          {loading ? <span className="auth-spinner" /> : 'Log in'}
        </motion.button>
        <div className="auth-divider">
          <span />
          <p>or</p>
          <span />
        </div>
        <motion.button className="auth-secondary-btn" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={onGoToRegister}>
          Create an account
        </motion.button>
      </motion.div>
      <motion.p className="auth-legal" variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { delay: 0.6 } } }}>
        By continuing, you agree to our Terms & Privacy Policy.
      </motion.p>
    </motion.div>
  );
};

// --- 10. Register Screen ---
const RegisterScreen = ({ onRegister, onGoToLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
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
    <motion.div className="auth-container" variants={containerVariants} initial="hidden" animate="show" exit="exit">
      <div className="auth-ring auth-ring--register" aria-hidden />
      <motion.div className="auth-wordmark" variants={{ hidden: { opacity: 0, y: -10 }, show: { opacity: 1, y: 0 } }}>
        E C H O
      </motion.div>
      <motion.div className="auth-card" variants={{ hidden: { opacity: 0, y: 30, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 22 } } }}>
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
            <motion.p className="auth-error" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
              {error}
            </motion.p>
          )}
        </AnimatePresence>
        <motion.button className={`auth-submit-btn ${loading ? 'loading' : ''}`} whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }} onClick={handleSubmit} disabled={loading}>
          {loading ? <span className="auth-spinner" /> : 'Create account'}
        </motion.button>
      </motion.div>
      <motion.p className="auth-legal" variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { delay: 0.7 } } }}>
        By continuing, you agree to our Terms & Privacy Policy.
      </motion.p>
    </motion.div>
  );
};

// --- 11. Daily Summary Prompt ---
const DailySummaryPrompt = ({ onYes, onNo }) => (
  <AnimatePresence>
    <motion.div className="summary-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <motion.div className="summary-card" initial={{ opacity: 0, y: 32, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97 }} transition={{ type: 'spring', stiffness: 320, damping: 28, delay: 0.05 }}>
        <div className="summary-ring" aria-hidden />
        <motion.div className="summary-icon" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.15 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </motion.div>
        <motion.h3 className="summary-title" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>Daily Summary</motion.h3>
        <motion.p className="summary-body" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.27 }}>Would you like to hear your daily summary?</motion.p>
        <motion.div className="summary-actions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}>
          <motion.button className="summary-btn summary-btn--yes" whileHover={{ scale: 1.04, y: -1 }} whileTap={{ scale: 0.96 }} onClick={onYes}>Yes, play it</motion.button>
          <motion.button className="summary-btn summary-btn--no" whileHover={{ scale: 1.04, y: -1 }} whileTap={{ scale: 0.96 }} onClick={onNo}>Not now</motion.button>
        </motion.div>
      </motion.div>
    </motion.div>
  </AnimatePresence>
);

const ProfileTab = ({ currentUser }) => {
  const [userInterests, setUserInterests] = useState([]);
  const [allInterests, setAllInterests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [userRes, interestsRes] = await Promise.all([
          fetch(`${API_BASE}/users/${currentUser.id}`),
          fetch(`${API_BASE}/interests`),
        ]);
        const userData = await userRes.json();
        const fetchedAll = await interestsRes.json();
        const interestIdSet = new Set(userData.interestIds || []);
        const current = fetchedAll.filter(i => interestIdSet.has(i.id));
        setAllInterests(fetchedAll);
        setUserInterests(current);
        setSelectedInterests(current.map(i => i.name));
      } catch (err) {
        console.warn('Could not load profile interests:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser]);

  const toggleInterest = (name) => {
    setSelectedInterests(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const handleSave = async () => {
    if (!currentUser?.username) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/users/${encodeURIComponent(currentUser.username)}/interests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interestNames: selectedInterests }),
      });
      if (!res.ok) throw new Error('Failed to save');
      const updated = allInterests.filter(i => selectedInterests.includes(i.name));
      setUserInterests(updated);
      setIsEditing(false);
    } catch (err) {
      console.warn('Could not save interests:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleEditOpen = () => {
    setSelectedInterests(userInterests.map(i => i.name));
    setIsEditing(true);
  };

  const initials = currentUser?.username
    ? currentUser.username.slice(0, 2).toUpperCase()
    : '??';

  return (
    <motion.div
      key="profile-view"
      className="profile-view"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
    >
      <div className="profile-card">
        <div className="profile-avatar-lg">{initials}</div>
        <h2 className="profile-username">{currentUser?.username}</h2>
        <p className="profile-label">Member</p>
      </div>

      <div className="profile-section">
        <div className="profile-section-header">
          <p className="profile-section-title">Interests</p>
          {!loading && !isEditing && (
            <motion.button
              className="profile-edit-btn"
              onClick={handleEditOpen}
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.95 }}
            >
              {userInterests.length === 0 ? '+ Add interests' : 'Edit'}
            </motion.button>
          )}
        </div>

        {loading ? (
          <div className="profile-loading">
            <span className="auth-spinner" style={{ borderTopColor: '#878787', borderColor: 'rgba(0,0,0,0.1)' }} />
            <span>Loading...</span>
          </div>
        ) : isEditing ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="profile-interests-edit-grid">
              {allInterests.map((interest, i) => (
                <motion.button
                  key={interest.id}
                  className={`interest-pill ${selectedInterests.includes(interest.name) ? 'selected' : ''}`}
                  onClick={() => toggleInterest(interest.name)}
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.025 }}
                  whileHover={{ scale: 1.05, y: -1 }}
                  whileTap={{ scale: 0.94 }}
                >
                  {interest.name}
                </motion.button>
              ))}
            </div>
            <div className="profile-edit-actions">
              <motion.button
                className="profile-save-btn"
                onClick={handleSave}
                disabled={saving}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.97 }}
              >
                {saving ? <span className="auth-spinner" /> : `Save (${selectedInterests.length} selected)`}
              </motion.button>
              <motion.button
                className="profile-cancel-btn"
                onClick={() => setIsEditing(false)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                Cancel
              </motion.button>
            </div>
          </motion.div>
        ) : userInterests.length === 0 ? (
          <p className="profile-empty">No interests added yet.</p>
        ) : (
          <div className="profile-interests-grid">
            {userInterests.map((interest, i) => (
              <motion.span
                key={interest.id}
                className="profile-interest-pill"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
              >
                {interest.name}
              </motion.span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// --- 11c. Record Daily Summary Prompt ---
const RecordDailySummaryPrompt = ({ onYes, onNo }) => (
  <AnimatePresence>
    <motion.div className="summary-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <motion.div className="summary-card" initial={{ opacity: 0, y: 32, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97 }} transition={{ type: 'spring', stiffness: 320, damping: 28, delay: 0.05 }}>
        <div className="summary-ring" aria-hidden />
        <motion.div className="summary-icon" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.15 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
          </svg>
        </motion.div>
        <motion.h3 className="summary-title" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>Record Today</motion.h3>
        <motion.p className="summary-body" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.27 }}>Would you like to record your daily note? Tell Echo how your day went.</motion.p>
        <motion.div className="summary-actions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}>
          <motion.button className="summary-btn summary-btn--yes" whileHover={{ scale: 1.04, y: -1 }} whileTap={{ scale: 0.96 }} onClick={onYes}>Yes, record now</motion.button>
          <motion.button className="summary-btn summary-btn--no" whileHover={{ scale: 1.04, y: -1 }} whileTap={{ scale: 0.96 }} onClick={onNo}>Maybe later</motion.button>
        </motion.div>
      </motion.div>
    </motion.div>
  </AnimatePresence>
);

// --- 11d. Recording Session ---
const RecordingSession = ({ currentUser, audioRef ,onDone }) => {
  const [phase, setPhase] = useState('prompting'); // prompting | recording | processing | uploading | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const silenceCheckRef = useRef(null);
  const streamRef = useRef(null);

  // Speak a prompt then start recording
  const speakPromptThenRecord = useCallback(async () => {
    setPhase('prompting');
  
    // Stop anything currently playing before speaking
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null; // cancel any chained callbacks
      try { URL.revokeObjectURL(audioRef.current.src); } catch {}
    }
  
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/speech/text_to_speech?username=${encodeURIComponent(currentUser.username)}&text=${encodeURIComponent("What was your day like? Take your time, and when you're done just click the done button.")}`,
        { method: 'POST' }
      );
      if (!res.ok) throw new Error('TTS failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
  
      audioRef.current = new Audio(url);
      audioRef.current.play();
      audioRef.current.onended = () => {
        URL.revokeObjectURL(url);
        startRecording();
      };
    } catch (err) {
      console.warn('Prompt TTS failed:', err);
      startRecording();
    }
  }, [currentUser, audioRef]);

  const stopDailyRecording = useCallback(() => {
    cancelAnimationFrame(silenceCheckRef.current);
    clearInterval(recordingTimerRef.current);
    audioContextRef.current?.close();
    if (mediaRecorderRef2.current?.state !== 'inactive') {
      mediaRecorderRef2.current?.stop();
    }
    setRecordingPhase('processing');
  }, []);
  
  const startDailyRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      recordingChunksRef.current = [];
  
      const mimeType = MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
  
      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef2.current = mr;
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordingChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        try {
          setRecordingPhase('uploading');
          const ext = mimeType.includes('ogg') ? '.ogg' : '.webm';
          const blob = new Blob(recordingChunksRef.current, { type: mimeType });
          const duration = Math.floor((Date.now() - recordingStartRef.current) / 1000);
          const today = new Date().toISOString().split('T')[0];
          const uploadForm = new FormData();
          uploadForm.append('user_id', currentUserRef.current.id);
          uploadForm.append('date', today);
          uploadForm.append('duration_sec', String(duration));
          uploadForm.append('audio_file', blob, `daily-note${ext}`);
          await fetch(`${API_BASE}/daily-notes/upload`, { method: 'POST', body: uploadForm });
          setRecordingPhase('done');
          await speakThenAct("Got it, your daily note has been saved.", () => {
            setRecordingPhase(null);
            promptActionChoice();
          });
        } catch (err) {
          console.warn('Upload failed:', err);
          setRecordingPhase(null);
          promptActionChoice();
        }
      };
  
      mr.start(100);
      recordingStartRef.current = Date.now();
      setRecordingPhase('recording');
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(Math.floor((Date.now() - recordingStartRef.current) / 1000));
      }, 500);
  
      // Silence detection
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.fftSize);
      let silenceStart = null;
  
      const check = () => {
        if (mediaRecorderRef2.current?.state === 'inactive') return;
        analyser.getByteTimeDomainData(dataArray);
        const rms = Math.sqrt(
          dataArray.reduce((sum, val) => sum + Math.pow(val - 128, 2), 0) / dataArray.length
        );
        if (rms < 8) {
          if (!silenceStart) silenceStart = Date.now();
          else if (Date.now() - silenceStart >= 7000) { stopDailyRecording(); return; }
        } else {
          silenceStart = null;
        }
        silenceCheckRef.current = requestAnimationFrame(check);
      };
      silenceCheckRef.current = requestAnimationFrame(check);
  
    } catch (err) {
      console.warn('Mic failed:', err);
      setRecordingPhase(null);
    }
  }, [speakThenAct, stopDailyRecording, promptActionChoice]);


  useEffect(() => {
    speakPromptThenRecord();
    return () => {
      cancelAnimationFrame(silenceCheckRef.current);
      clearInterval(timerRef.current);
      audioContextRef.current?.close();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const phaseLabel = {
    prompting: 'Getting ready…',
    recording: 'Recording…',
    processing: 'Processing…',
    uploading: 'Saving…',
    done: 'Saved!',
    error: 'Something went wrong',
  };

  const phaseBody = {
    prompting: 'Listen for your prompt, then speak freely.',
    recording: <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>{formatTime(seconds)}</span>,
    processing: 'Checking your recording…',
    uploading: 'Uploading your daily note…',
    done: 'Your daily note has been saved.',
    error: errorMsg,
  };

  return (
    <AnimatePresence>
      <motion.div className="summary-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
        <motion.div className="summary-card" initial={{ opacity: 0, y: 32, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97 }} transition={{ type: 'spring', stiffness: 320, damping: 28 }}>
          <div className="summary-ring" aria-hidden />

          <motion.div
            className="summary-icon"
            animate={phase === 'recording' ? { scale: [1, 1.12, 1] } : {}}
            transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
            initial={{ scale: 0.7, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
          >
            {phase === 'done' ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ) : phase === 'error' ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            )}
          </motion.div>

          <motion.h3 className="summary-title">{phaseLabel[phase]}</motion.h3>
          <motion.p className="summary-body">{phaseBody[phase]}</motion.p>

          <motion.div className="summary-actions">
            {(phase === 'prompting' || phase === 'recording' || phase === 'processing' || phase === 'uploading') && (
              <motion.button
                className="summary-btn summary-btn--no"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => { stopRecording(); onDone(); }}
              >
                Cancel
              </motion.button>
            )}
            {phase === 'error' && (
              <>
                <motion.button className="summary-btn summary-btn--yes" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={() => { setPhase('prompting'); setSeconds(0); setErrorMsg(''); speakPromptThenRecord(); }}>
                  Try again
                </motion.button>
                <motion.button className="summary-btn summary-btn--no" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={onDone}>
                  Skip
                </motion.button>
              </>
            )}
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// --- 12. Main Application Component ---
const App = () => {
  const [summaryPhase, setSummaryPhase] = useState(null);
  const [appState, setAppState] = useState('booting');
  const [currentUser, setCurrentUser] = useState(null);
  const [recordingPhase, setRecordingPhase] = useState(null);
  const [activeTab, setActiveTab] = useState('voice');
  const [isFriendsListOpen, setIsFriendsListOpen] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState(null);
  const [transcript, setTranscript] = useState("");

  const [friends, setFriends] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(false);

  const [showRecordPrompt, setShowRecordPrompt] = useState(false);
  const [showRecordingSession, setShowRecordingSession] = useState(false);
  const [spokenText, setSpokenText] = useState(''); // the full text being spoken
  const [revealedWords, setRevealedWords] = useState(0); // how many words shown so far

  const [listeningForResponse, setListeningForResponse] = useState(false);

  const currentUserRef = useRef(null);
  const mediaRecorderRef2 = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const recordingStartRef = useRef(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

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

  const handleLogin = (user) => {
    setCurrentUser(user);
    setAppState('main');
    fetchFriends(user.username);
    askDailySummaryVoice(user);
  };

  const askDailySummaryVoice = useCallback(async (user) => {
    setSummaryPhase('asking');
  
    const questionText = "Would you like to hear your daily summary?";
    const words = questionText.split(' ');
  
    setSpokenText(questionText);
    setRevealedWords(0);
  
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/speech/text_to_speech?username=${encodeURIComponent(user.username)}&text=${encodeURIComponent(questionText)}`,
        { method: 'POST' }
      );
      if (!res.ok) throw new Error('TTS failed');
      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      if (audioRef.current) { audioRef.current.pause(); URL.revokeObjectURL(audioRef.current.src); }
      audioRef.current = new Audio(audioUrl);
  
      audioRef.current.addEventListener('loadedmetadata', () => {
        const duration = audioRef.current.duration;
        const interval = duration / words.length;
        words.forEach((_, i) => {
          setTimeout(() => setRevealedWords(i + 1), i * interval * 1000);
        });
      });
  
      audioRef.current.play();
      audioRef.current.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setSpokenText('');
        setRevealedWords(0);
        listenForSummaryResponseRef.current?.(); // via ref, not direct dep
      };
    } catch (err) {
      console.warn('TTS prompt failed:', err);
      setSpokenText('');
      setRevealedWords(words.length);
    }
  }, []); // no deps needed — reads everything via refs

  const handleRegister = (user) => {
    setCurrentUser(user);
    setAppState('setup');
    setFriends([]);
  };

  const graphData = useMemo(() => {
    if (!currentUser) return { nodes: [], links: [] };
    const colours = ['#0a0a0a', '#333333', '#555555', '#878787'];
  
    // Central "you" node
    const centerNode = {
      id: currentUser.id ?? 'me',
      name: currentUser.username,
      val: 3,
      colour: '#0a0a0a',
      isMe: true,
    };
  
    const friendNodes = friends.map((friend, i) => ({
      id: friend.id,
      name: friend.username,
      val: 1.5,
      colour: colours[(i + 1) % colours.length],
    }));
  
    const nodes = [centerNode, ...friendNodes];
  
    // Every friend links to the center
    const links = friendNodes.map(f => ({
      source: centerNode.id,
      target: f.id,
    }));
  
    // Optional friend-to-friend links (more selective)
    for (let i = 0; i < friendNodes.length; i++) {
      for (let j = i + 1; j < friendNodes.length; j++) {
        if (Math.random() > 0.75) {
          links.push({ source: friendNodes[i].id, target: friendNodes[j].id });
        }
      }
    }
  
    return { nodes, links };
  }, [friends, currentUser]);

  useEffect(() => {
    const timer = setTimeout(() => setAppState('login'), 2500);
    return () => clearTimeout(timer);
  }, []);

  const conversation = useConversation({
    onMessage: (message) => { if (message.text) setTranscript(message.text); },
    onError: (error) => console.error('ElevenLabs SDK Error:', error),
  });

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const isListening = conversation.status === 'connected';
  const audioRef = useRef(null); 

  const signedUrlRef = useRef(null);
  const signedUrlExpiryRef = useRef(null);
  const micStreamRef = useRef(null);

  const prefetchSignedUrl = useCallback(async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/envs/elevenlabs');
      if (!response.ok) return;
      const data = await response.json();
      signedUrlRef.current = data.signedUrl;
      signedUrlExpiryRef.current = Date.now() + 55_000;
    } catch (err) {
      console.warn('Prefetch failed:', err);
    }
  }, []);
  
  const warmMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
    } catch (err) {
      console.warn('Mic warm-up failed:', err);
    }
  }, []);

  useEffect(() => {
    if (appState === 'main') {
      prefetchSignedUrl();
      warmMic();
    }
    return () => micStreamRef.current?.getTracks().forEach(t => t.stop());
  }, [appState, prefetchSignedUrl, warmMic]);

  const toggleListening = useCallback(async () => {
    if (isListening) {
      await conversation.endSession();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } else {
      try {
        const [stream, signedUrl] = await Promise.all([
          micStreamRef.current
            ? Promise.resolve(micStreamRef.current)
            : navigator.mediaDevices.getUserMedia({ audio: true }),
          (async () => {
            if (signedUrlRef.current && Date.now() < signedUrlExpiryRef.current) {
              return signedUrlRef.current;
            }
            const response = await fetch('http://127.0.0.1:8000/envs/elevenlabs');
            if (!response.ok) {
              const errData = await response.json();
              throw new Error(errData.detail || 'Backend failed');
            }
            const data = await response.json();
            signedUrlRef.current = data.signedUrl;
            signedUrlExpiryRef.current = Date.now() + 55_000;
            return data.signedUrl;
          })(),
        ]);
  
        audioChunksRef.current = [];
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };
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
            if (!sttResponse.ok) throw new Error('STT request failed');
            const sttData = await sttResponse.json();
            setTranscript(sttData.text);
          } catch (err) {
            console.error('Transcription error:', err);
          }
        };
        mediaRecorder.start();
        await conversation.startSession({ signedUrl });
      } catch (err) {
        console.error('Voice session failed:', err);
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
    setShowRecordPrompt(false);
    setShowRecordingSession(false);
    if (isListening) conversation.endSession();
    setAppState('login');
  };

  // ── Refs for circular dependencies ──────────────────────────────────────────
  const listenForSummaryResponseRef = useRef(null);
  const handleGeneralisedChoiceRef = useRef(null);
  const listenForActionChoiceRef = useRef(null);
  const handleActionChoiceRef = useRef(null);

  // ── 1. speakThenAct (no deps, must be first as everything uses it) ───────────
  const speakThenAct = useCallback(async (text, onDone) => {
    try {
      const user = currentUserRef.current;
      if (!user?.username) { onDone?.(); return; }
  
      const res = await fetch(
        `http://127.0.0.1:8000/speech/text_to_speech?username=${encodeURIComponent(user.username)}&text=${encodeURIComponent(text)}`,
        { method: 'POST' }
      );
      if (!res.ok) throw new Error('TTS failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) { audioRef.current.pause(); URL.revokeObjectURL(audioRef.current.src); }
  
      // Set the new spoken text and reset word counter
      const words = text.split(' ');
      setSpokenText(text);
      setRevealedWords(0);
  
      audioRef.current = new Audio(url);
  
      audioRef.current.addEventListener('loadedmetadata', () => {
        const duration = audioRef.current.duration;
        const interval = duration / words.length;
        words.forEach((_, i) => {
          setTimeout(() => setRevealedWords(i + 1), i * interval * 1000);
        });
      });
  
      audioRef.current.play();
      audioRef.current.onended = () => {
        URL.revokeObjectURL(url);
        setSpokenText('');
        setRevealedWords(0);
        onDone?.();
      };
    } catch (err) {
      console.warn('speakThenAct failed:', err);
      setSpokenText('');
      setRevealedWords(0);
      onDone?.();
    }
  }, []);

  const speakThenActRef = useRef(null);
  // after speakThenAct is defined:
  speakThenActRef.current = speakThenAct;
    // ── 2. listenForSummaryResponse (no deps, calls handleGeneralisedChoice via ref) ──
  const listenForSummaryResponse = useCallback(async () => {
    setListeningForResponse(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        try {
          const blob = new Blob(chunks, { type: mimeType });
          const formData = new FormData();
          formData.append('file', blob, 'response.webm');
          formData.append('model_id', 'scribe_v1');
          const sttRes = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
            method: 'POST',
            headers: { 'xi-api-key': import.meta.env.VITE_ELEVENLABS_API_KEY },
            body: formData,
          });
          if (!sttRes.ok) throw new Error('STT failed');
          const { text } = await sttRes.json();
      
          // Guard: if nothing was heard, ask again
          if (!text?.trim()) {
            setListeningForResponse(false);
            await speakThenActRef.current?.(
              "Sorry, I didn't catch that. Would you like to hear your daily summary?",
              () => listenForSummaryResponseRef.current?.()
            );
            return;
          }
      
          const genRes = await fetch(
            `http://127.0.0.1:8000/speech/yes_or_no?text=${encodeURIComponent(text)}`,
            { method: 'POST' }
          );
          if (!genRes.ok) {
            const errText = await genRes.text();
            throw new Error(`yes_or_no failed: ${genRes.status} ${errText}`);
          }
          const choice = await genRes.json();
          handleGeneralisedChoiceRef.current?.(choice);
        } catch (err) {
          console.warn('Response processing failed:', err);
          setListeningForResponse(false);
          setSummaryPhase(null);
        }
      };
      recorder.start();
      setTimeout(() => recorder.stop(), 4000);
    } catch (err) {
      console.warn('Mic failed:', err);
      setListeningForResponse(false);
    }
  }, []);

  // ── 3. listenForActionChoice (no deps, calls handleActionChoice via ref) ─────
  const listenForActionChoice = useCallback(async () => {
    setListeningForResponse(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        try {
          const blob = new Blob(chunks, { type: mimeType });
          const formData = new FormData();
          formData.append('file', blob, 'response.webm');
          formData.append('model_id', 'scribe_v1');
          const sttRes = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
            method: 'POST',
            headers: { 'xi-api-key': import.meta.env.VITE_ELEVENLABS_API_KEY },
            body: formData,
          });
          if (!sttRes.ok) throw new Error('STT failed');
          const { text } = await sttRes.json();
          const genRes = await fetch(
            `http://127.0.0.1:8000/speech/generalise?text=${encodeURIComponent(text)}`,
            { method: 'POST' }
          );
          if (!genRes.ok) throw new Error('Generalise failed');
          const choice = await genRes.json();
          handleActionChoiceRef.current?.(choice); // via ref — not yet defined
        } catch (err) {
          console.warn('Action choice processing failed:', err);
          setListeningForResponse(false);
        }
      };
      recorder.start();
      setTimeout(() => recorder.stop(), 4000);
    } catch (err) {
      console.warn('Mic failed:', err);
      setListeningForResponse(false);
    }
  }, []);

  // ── 4. promptActionChoice (depends on speakThenAct only, calls listen via ref) ──
  const promptActionChoice = useCallback(async () => {
    await speakThenAct(
      "What would you like to do? You can ask a question, answer a question, record your daily note, or listen to your post summary.",
      () => listenForActionChoiceRef.current?.()
    );
  }, [speakThenAct]);

  const stopDailyRecording = useCallback(() => {
    clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef2.current?.state !== 'inactive') {
      mediaRecorderRef2.current?.stop();
    }
  }, []);
  
  const startDailyRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingChunksRef.current = [];
  
      const mimeType = MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
  
      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef2.current = mr;
  
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordingChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        try {
          setRecordingPhase('uploading');
          const ext = mimeType.includes('ogg') ? '.ogg' : '.webm';
          const blob = new Blob(recordingChunksRef.current, { type: mimeType });
          const duration = Math.floor((Date.now() - recordingStartRef.current) / 1000);
          const today = new Date().toISOString().split('T')[0];
          const uploadForm = new FormData();
          uploadForm.append('user_id', currentUserRef.current.id);
          uploadForm.append('date', today);
          uploadForm.append('duration_sec', String(duration));
          uploadForm.append('audio_file', blob, `daily-note${ext}`);
          await fetch(`${API_BASE}/daily-notes/upload`, { method: 'POST', body: uploadForm });
          setRecordingPhase('done');
          await speakThenAct("Got it, your daily note has been saved.", () => {
            setRecordingPhase(null);
            promptActionChoice();
          });
        } catch (err) {
          console.warn('Upload failed:', err);
          setRecordingPhase(null);
          promptActionChoice();
        }
      };
  
      mr.start(100);
      recordingStartRef.current = Date.now();
      setRecordingPhase('recording');
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(Math.floor((Date.now() - recordingStartRef.current) / 1000));
      }, 500);
  
    } catch (err) {
      console.warn('Mic failed:', err);
      setRecordingPhase(null);
    }
  }, [speakThenAct, promptActionChoice]);

  // ── 5. handleSummaryYes (depends on promptActionChoice) ──────────────────────
  const handleSummaryYes = useCallback(async () => {
    const user = currentUserRef.current;
    if (!user?.username) return;
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/speech/summary/daily?username=${encodeURIComponent(user.username)}`,
        { method: 'POST' }
      );
      if (!res.ok) throw new Error('Failed to fetch summary');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) { audioRef.current.pause(); URL.revokeObjectURL(audioRef.current.src); }
      audioRef.current = new Audio(url);
      audioRef.current.play();
      audioRef.current.onended = () => { URL.revokeObjectURL(url); promptActionChoice(); };
    } catch (err) {
      console.error('Daily summary error:', err);
      promptActionChoice();
    }
  }, [promptActionChoice]);

  // ── 6. handleActionChoice (depends on speakThenAct + handleSummaryYes, calls listen via ref) ──
  const handleActionChoice = useCallback(async (choice) => {
    setListeningForResponse(false);
    const trimmed = (typeof choice === 'string' ? choice : JSON.stringify(choice)).trim().toLowerCase();
    if (trimmed.includes('1') || trimmed.includes('ask a question')) {
      await speakThenAct("Sure, go ahead and ask your question.", () => { /* question flow */ });
    } else if (trimmed.includes('2') || trimmed.includes('answer a question')) {
      await speakThenAct("Okay, I'll find a question for you to answer.", () => { /* answer flow */ });
    } else if (trimmed.includes('3') || trimmed.includes('record')) {
      await speakThenAct(
        "What was your day like? Take your time, and when you're done just click the done button.",
        () => startDailyRecording()
      );
    } else if (trimmed.includes('4') || trimmed.includes('listen') || trimmed.includes('summary')) {
      await speakThenAct("Of course, here is your daily summary.", () => handleSummaryYes());
    } else {
      await speakThenAct(
        "Sorry, I didn't catch that. You can ask a question, answer a question, record your daily note, or listen to your summary.",
        () => listenForActionChoiceRef.current?.()
      );
    }
  }, [speakThenAct, handleSummaryYes]);

  // ── 7. handleGeneralisedChoice (depends on speakThenAct + handleSummaryYes + promptActionChoice) ──
  const handleGeneralisedChoice = useCallback(async (choice) => {
    setListeningForResponse(false);
    setSummaryPhase(null);
    const trimmed = (typeof choice === 'string' ? choice : JSON.stringify(choice)).trim().toLowerCase();
    if (trimmed.includes('yes') || trimmed.includes('1')) {
      await speakThenAct("Of course, here is your daily summary.", () => handleSummaryYes());
    } else if (trimmed.includes('no') || trimmed.includes('2')) {
      await speakThenAct("No problem.", () => promptActionChoice());
    } else {
      await speakThenAct(
        "Sorry, I didn't catch that. Would you like to hear your daily summary?",
        () => listenForSummaryResponseRef.current?.()
      );
    }
  }, [speakThenAct, handleSummaryYes, promptActionChoice]);

  // ── 8. Sync all refs after every render ──────────────────────────────────────
  listenForSummaryResponseRef.current = listenForSummaryResponse;
  handleGeneralisedChoiceRef.current = handleGeneralisedChoice;
  listenForActionChoiceRef.current = listenForActionChoice;
  handleActionChoiceRef.current = handleActionChoice;

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
    .graph-container {
      position: absolute;
      inset: 0;
      z-index: 2;
      cursor: grab;
      pointer-events: all;   /* was missing — this is what broke drag */
      touch-action: none;    /* prevents browser scroll from hijacking touch drag */
    }
    .graph-container:active { cursor: grabbing; }

    .interaction-overlay {
      position: absolute; top: 12%;
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
    .friends-list-header { display: flex; justify-content: space-between; align-items: center; padding: 0 24px 16px 24px; border-bottom: 1px solid rgba(0,0,0,0.05); }
    .friends-list-header h3 { font-size: 18px; font-weight: 700; margin: 0; letter-spacing: -0.02em; }
    .close-btn { background: transparent; border: none; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; padding: 4px; border-radius: 50%; transition: var(--transition-smooth); }
    .close-btn:hover { color: var(--text-primary); transform: rotate(90deg); background: rgba(0,0,0,0.05); }
    .friends-scroll-area { flex: 1; overflow-y: auto; padding: 8px 12px 12px 12px; }
    .friends-scroll-area::-webkit-scrollbar { display: none; }
    .friend-list-item { width: 100%; display: flex; align-items: center; gap: 16px; padding: 12px 12px; background: transparent; border: none; border-radius: 16px; cursor: pointer; text-align: left; transition: var(--transition-smooth); }
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

    /* ── Search section ── */
    .search-section {
      padding: 14px 16px 10px 16px;
      border-bottom: 1px solid rgba(0,0,0,0.05);
    }
    .search-input-wrapper {
      position: relative; display: flex; align-items: center;
    }
    .search-icon {
      position: absolute; left: 12px; color: var(--text-secondary); pointer-events: none; flex-shrink: 0;
    }
    .search-input {
      width: 100%; padding: 10px 36px 10px 34px;
      background: rgba(0,0,0,0.04);
      border: 1px solid rgba(0,0,0,0.07);
      border-radius: 12px;
      font-size: 14px; font-weight: 400; font-family: inherit;
      color: var(--text-primary);
      outline: none;
      transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
    }
    .search-input::placeholder { color: #bbb; }
    .search-input:focus {
      border-color: rgba(0,0,0,0.18);
      background: #fff;
      box-shadow: 0 0 0 3px rgba(0,0,0,0.04);
    }
    .search-clear-btn {
      position: absolute; right: 10px;
      background: rgba(0,0,0,0.07); border: none;
      border-radius: 50%; width: 18px; height: 18px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: var(--text-secondary);
      transition: background 0.15s ease;
      padding: 0;
    }
    .search-clear-btn:hover { background: rgba(0,0,0,0.13); color: var(--text-primary); }

    .search-status {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 4px 2px 4px;
      font-size: 12px; color: var(--text-secondary);
    }
    .search-spinner {
      width: 12px; height: 12px; border-radius: 50%;
      border: 1.5px solid rgba(0,0,0,0.1);
      border-top-color: var(--text-secondary);
      animation: spin 0.7s linear infinite;
      display: inline-block; flex-shrink: 0;
    }

    .search-results {
      margin-top: 8px;
      background: rgba(255,255,255,0.8);
      border: 1px solid rgba(0,0,0,0.07);
      border-radius: 14px;
      overflow: hidden;
    }
    .search-result-item {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 12px;
      border-bottom: 1px solid rgba(0,0,0,0.04);
      transition: background 0.15s ease;
    }
    .search-result-item:last-child { border-bottom: none; }
    .search-result-item:hover { background: rgba(0,0,0,0.02); }
    .search-result-name {
      font-size: 14px; font-weight: 600; color: var(--text-primary); flex: 1;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .add-friend-btn {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 6px 11px; border-radius: 20px;
      background: var(--text-primary); color: var(--bg-colour);
      border: none; font-size: 12px; font-weight: 600; font-family: inherit;
      cursor: pointer; flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.12);
      transition: background 0.2s ease, box-shadow 0.2s ease;
    }
    .add-friend-btn:hover { background: #1a1a1a; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }

    .search-result-badge {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 5px 10px; border-radius: 20px;
      font-size: 11px; font-weight: 600; flex-shrink: 0;
    }
    .badge--connected {
      background: rgba(0,0,0,0.05); color: var(--text-secondary);
      border: 1px solid rgba(0,0,0,0.08);
    }
    .badge--sent {
      background: rgba(0,0,0,0.04); color: var(--text-secondary);
      border: 1px solid rgba(0,0,0,0.06);
    }

    .search-error {
      font-size: 12px; color: #c0392b; margin: 8px 0 0 0;
      padding: 8px 10px; background: rgba(192,57,43,0.05);
      border-radius: 8px; border: 1px solid rgba(192,57,43,0.1);
    }
    .search-empty {
      font-size: 12px; color: var(--text-secondary);
      margin: 8px 0 0 0; padding: 8px 4px;
      font-style: italic;
    }

    /* ── Section labels ── */
    .section-label {
      display: flex; align-items: center; gap: 8px;
      font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--text-secondary);
      padding: 10px 12px 6px 12px;
    }
    .requests-badge {
      display: inline-flex; align-items: center; justify-content: center;
      width: 16px; height: 16px; border-radius: 50%;
      background: var(--text-primary); color: var(--bg-colour);
      font-size: 9px; font-weight: 800; letter-spacing: 0;
    }

    /* ── Incoming requests ── */
    .requests-section { margin-bottom: 4px; }
    .request-item {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 12px; border-radius: 14px;
      margin-bottom: 2px;
      background: rgba(0,0,0,0.02);
      border: 1px solid rgba(0,0,0,0.05);
      overflow: hidden;
    }
    .request-item--accepted {
      background: rgba(0,0,0,0.01);
      border-color: rgba(0,0,0,0.03);
    }
    .request-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
    .request-name { font-size: 14px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .request-sub { font-size: 11px; color: var(--text-secondary); }
    .request-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
    .request-btn {
      width: 30px; height: 30px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      border: none; cursor: pointer;
      transition: background 0.15s ease, box-shadow 0.15s ease;
    }
    .request-btn--accept {
      background: var(--text-primary); color: var(--bg-colour);
      box-shadow: 0 2px 8px rgba(0,0,0,0.14);
    }
    .request-btn--accept:hover { background: #1a1a1a; box-shadow: 0 4px 12px rgba(0,0,0,0.22); }
    .request-btn--decline {
      background: rgba(0,0,0,0.06); color: var(--text-secondary);
    }
    .request-btn--decline:hover { background: rgba(0,0,0,0.12); color: var(--text-primary); }

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
    .auth-ring {
      position: absolute; width: 520px; height: 520px; border-radius: 50%;
      border: 1px solid rgba(0,0,0,0.06); top: 50%; left: 50%;
      transform: translate(-50%, -50%); pointer-events: none;
      animation: authRingPulse 6s ease-in-out infinite;
    }
    .auth-ring::before { content: ''; position: absolute; inset: 40px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.04); animation: authRingPulse 6s ease-in-out infinite 1.5s; }
    .auth-ring::after { content: ''; position: absolute; inset: 90px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.03); animation: authRingPulse 6s ease-in-out infinite 3s; }
    .auth-ring--register { animation-delay: -2s; }
    @keyframes authRingPulse {
      0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      50% { transform: translate(-50%, -50%) scale(1.04); opacity: 0.6; }
    }
    .auth-wordmark { font-size: 13px; font-weight: 800; letter-spacing: 0.35em; color: var(--text-primary); margin-bottom: 32px; position: relative; z-index: 2; }
    .auth-card { width: 100%; max-width: 400px; background: rgba(255,255,255,0.9); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(0,0,0,0.07); border-radius: 24px; padding: 32px; box-shadow: 0 8px 48px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04); position: relative; z-index: 2; }
    .auth-card-header { margin-bottom: 28px; }
    .auth-title { font-size: 26px; font-weight: 800; letter-spacing: -0.03em; margin: 0 0 6px 0; color: var(--text-primary); }
    .auth-sub { font-size: 14px; color: var(--text-secondary); margin: 0; }
    .auth-back-btn { display: inline-flex; align-items: center; gap: 6px; background: transparent; border: none; padding: 0 0 16px 0; color: var(--text-secondary); font-size: 13px; font-weight: 500; cursor: pointer; transition: color 0.2s ease; }
    .auth-back-btn:hover { color: var(--text-primary); }
    .auth-fields { display: flex; flex-direction: column; gap: 16px; margin-bottom: 8px; }
    .auth-field { display: flex; flex-direction: column; gap: 7px; }
    .auth-label { font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-secondary); }
    .auth-input-wrapper { position: relative; }
    .auth-input { width: 100%; padding: 13px 16px; background: rgba(0,0,0,0.03); border: 1px solid rgba(0,0,0,0.08); border-radius: 12px; font-size: 15px; font-weight: 400; color: var(--text-primary); font-family: inherit; outline: none; transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease; }
    .auth-input::placeholder { color: #bbb; }
    .auth-input:focus { border-color: rgba(0,0,0,0.2); background: #fff; box-shadow: 0 0 0 3px rgba(0,0,0,0.04); }
    .auth-eye-btn { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: transparent; border: none; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; padding: 4px; border-radius: 6px; transition: color 0.2s ease; }
    .auth-eye-btn:hover { color: var(--text-primary); }
    .auth-error { font-size: 13px; color: #c0392b; font-weight: 500; margin: 8px 0 4px 0; padding: 10px 14px; background: rgba(192,57,43,0.06); border-radius: 10px; border: 1px solid rgba(192,57,43,0.12); }
    .auth-submit-btn { width: 100%; margin-top: 20px; padding: 15px; background: var(--text-primary); color: var(--bg-colour); border: none; border-radius: 14px; font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer; letter-spacing: 0.01em; box-shadow: 0 6px 20px rgba(0,0,0,0.14); transition: background 0.2s ease, box-shadow 0.25s ease, transform 0.15s ease; display: flex; align-items: center; justify-content: center; min-height: 52px; }
    .auth-submit-btn:hover { background: #1a1a1a; box-shadow: 0 10px 28px rgba(0,0,0,0.2); }
    .auth-submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }
    .auth-spinner { width: 18px; height: 18px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; animation: spin 0.7s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .auth-divider { display: flex; align-items: center; gap: 12px; margin: 20px 0 4px; }
    .auth-divider span { flex: 1; height: 1px; background: rgba(0,0,0,0.07); }
    .auth-divider p { font-size: 12px; color: var(--text-secondary); font-weight: 500; margin: 0; }
    .auth-secondary-btn { width: 100%; margin-top: 12px; padding: 14px; background: transparent; color: var(--text-primary); border: 1px solid rgba(0,0,0,0.1); border-radius: 14px; font-size: 15px; font-weight: 600; font-family: inherit; cursor: pointer; transition: background 0.2s ease, border-color 0.2s ease; }
    .auth-secondary-btn:hover { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.18); }
    .auth-legal { font-size: 11px; color: var(--text-secondary); text-align: center; margin-top: 24px; max-width: 280px; line-height: 1.6; position: relative; z-index: 2; }

    /* ── Daily Summary Prompt ── */
    .summary-backdrop { position: absolute; inset: 0; z-index: 60; display: flex; align-items: flex-end; justify-content: center; padding-bottom: max(120px, calc(env(safe-area-inset-bottom) + 100px)); background: rgba(250, 250, 250, 0.5); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); pointer-events: all; }
    .summary-card { position: relative; overflow: hidden; width: calc(100% - 48px); max-width: 360px; background: rgba(255, 255, 255, 0.92); backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px); border: 1px solid rgba(0, 0, 0, 0.07); border-radius: 28px; padding: 32px 28px 28px; box-shadow: 0 24px 64px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.04); display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0; }
    .summary-ring { position: absolute; top: -60px; right: -60px; width: 180px; height: 180px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.05); pointer-events: none; }
    .summary-ring::before { content: ''; position: absolute; inset: 24px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.04); }
    .summary-icon { width: 52px; height: 52px; border-radius: 50%; background: var(--text-primary); color: var(--bg-colour); display: flex; align-items: center; justify-content: center; margin-bottom: 18px; box-shadow: 0 8px 20px rgba(0,0,0,0.16); }
    .summary-title { font-size: 18px; font-weight: 800; letter-spacing: -0.025em; color: var(--text-primary); margin: 0 0 8px 0; }
    .summary-body { font-size: 14px; color: var(--text-secondary); line-height: 1.55; margin: 0 0 24px 0; max-width: 240px; }
    .summary-actions { display: flex; flex-direction: column; gap: 10px; width: 100%; }
    .summary-btn { width: 100%; padding: 14px; border-radius: 14px; font-size: 15px; font-weight: 600; font-family: inherit; cursor: pointer; border: none; transition: box-shadow 0.2s ease, background 0.2s ease; }
    .summary-btn--yes { background: var(--text-primary); color: var(--bg-colour); box-shadow: 0 6px 18px rgba(0,0,0,0.14); }
    .summary-btn--yes:hover { background: #1a1a1a; box-shadow: 0 10px 24px rgba(0,0,0,0.22); }
    .summary-btn--no { background: transparent; color: var(--text-secondary); border: 1px solid rgba(0,0,0,0.08); }
    .summary-btn--no:hover { background: rgba(0,0,0,0.03); color: var(--text-primary); border-color: rgba(0,0,0,0.14); }

    /* ── Profile tab ── */
.profile-view {
  position: absolute; inset: 0; z-index: 10;
  background: var(--bg-colour);
  overflow-y: auto;
  padding: max(100px, env(safe-area-inset-top)) 24px max(120px, env(safe-area-inset-bottom)) 24px;
  display: flex; flex-direction: column; align-items: center; gap: 24px;
}
.profile-view::-webkit-scrollbar { display: none; }
.profile-card {
  width: 100%; max-width: 400px;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(0,0,0,0.07);
  border-radius: 24px;
  padding: 32px 24px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.05);
}
.profile-avatar-lg {
  width: 72px; height: 72px; border-radius: 50%;
  background: var(--text-primary); color: var(--bg-colour);
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 700; letter-spacing: 0.04em;
  margin-bottom: 8px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.15);
}
.profile-username {
  font-size: 22px; font-weight: 800; letter-spacing: -0.03em;
  color: var(--text-primary); margin: 0;
}
.profile-label {
  font-size: 12px; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--text-secondary); margin: 0;
}
.profile-section {
  width: 75%;
  display: flex; flex-direction: column; gap: 12px;
}
.profile-section-title {
  font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--text-secondary);
  margin: 0; padding: 0 4px;
}
.profile-interests-edit-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 14px;
  margin-bottom: 20px;
  width: 100%;
}
.profile-interest-pill {
  padding: 8px 16px; border-radius: 24px;
  background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.07);
  font-size: 13px; font-weight: 500; color: var(--text-primary);
  transition: var(--transition-smooth);
}
.profile-interest-pill:hover {
  background: rgba(0,0,0,0.08); border-color: rgba(0,0,0,0.14);
}
.profile-loading {
  display: flex; align-items: center; gap: 10px;
  font-size: 13px; color: var(--text-secondary); padding: 4px;
}
.profile-empty {
  font-size: 13px; color: var(--text-secondary);
  margin: 0; padding: 4px; font-style: italic;
}
.profile-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
  margin-bottom: 4px;
}
.profile-section-header .profile-section-title {
  margin: 0;
  padding: 0;
}
.profile-edit-btn {
  font-size: 12px; font-weight: 600; font-family: inherit;
  color: var(--text-secondary);
  background: rgba(0,0,0,0.04);
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 20px;
  padding: 5px 12px;
  cursor: pointer;
  transition: var(--transition-smooth);
  letter-spacing: 0.01em;
}
.profile-edit-btn:hover {
  background: var(--text-primary);
  color: var(--bg-colour);
  border-color: var(--text-primary);
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
}
.profile-interests-edit-grid {
  display: flex; flex-wrap: wrap; gap: 14px;
  margin-bottom: 20px;
}
.profile-edit-actions {
  display: flex; flex-direction: column; gap: 10px;
}
.profile-save-btn {
  width: 100%; padding: 14px;
  background: var(--text-primary); color: var(--bg-colour);
  border: none; border-radius: 14px;
  font-size: 15px; font-weight: 600; font-family: inherit;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(0,0,0,0.14);
  transition: background 0.2s ease, box-shadow 0.2s ease;
  display: flex; align-items: center; justify-content: center; min-height: 50px;
}
.profile-save-btn:hover { background: #1a1a1a; box-shadow: 0 10px 28px rgba(0,0,0,0.2); }
.profile-save-btn:disabled { opacity: 0.7; cursor: not-allowed; }
.profile-cancel-btn {
  width: 100%; padding: 13px;
  background: transparent; color: var(--text-secondary);
  border: 1px solid rgba(0,0,0,0.08); border-radius: 14px;
  font-size: 15px; font-weight: 600; font-family: inherit;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}
.profile-cancel-btn:hover {
  background: rgba(0,0,0,0.03);
  border-color: rgba(0,0,0,0.18);
  color: var(--text-primary);
}

.summary-inline-btn {
  padding: 11px 22px; border-radius: 24px; font-size: 14px;
  font-weight: 600; font-family: inherit; cursor: pointer; border: none;
  transition: box-shadow 0.2s ease, background 0.2s ease;
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
}
.summary-inline-btn--yes {
  background: var(--text-primary); color: var(--bg-colour);
  box-shadow: 0 4px 16px rgba(0,0,0,0.14);
}
.summary-inline-btn--yes:hover { background: #1a1a1a; box-shadow: 0 8px 24px rgba(0,0,0,0.22); }
.summary-inline-btn--no {
  background: rgba(255,255,255,0.6); color: var(--text-secondary);
  border: 1px solid rgba(0,0,0,0.08);
}
.summary-inline-btn--no:hover { background: rgba(255,255,255,0.9); color: var(--text-primary); }
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
              <img
                src="/GoogleSearchImage.svg"
                alt=""
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  width: '700px',
                  height: '700px',
                  opacity: 0.06,
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              />
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
          <AnimatePresence mode="wait">
            {appState === 'login' && (
              <LoginScreen key="login" onLogin={handleLogin} onGoToRegister={() => setAppState('register')} />
            )}
            {appState === 'register' && (
              <RegisterScreen key="register" onRegister={handleRegister} onGoToLogin={() => setAppState('login')} />
            )}
            {appState === 'main' && activeTab === 'profile' && (
              <ProfileTab key="profile-view" currentUser={currentUser} />
            )}
          </AnimatePresence>

          {(appState === 'setup' || appState === 'main') && (
            <>
              <header className="top-header">
                <MagneticButton className="header-icon" ariaLabel="Menu" hoverScale={1.1} onClick={() => setIsFriendsListOpen(true)}>
                  <Menu size={20} color="var(--text-primary)" strokeWidth={1.5} />
                </MagneticButton>
                <motion.h1 className="logo-text" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}>
                  {currentUser ? currentUser.username : 'Echo'}
                </motion.h1>
                <MagneticButton className="header-icon" ariaLabel="Log out" hoverScale={1.1} onClick={handleLogout}>
                  <LogOut size={18} color="var(--text-primary)" strokeWidth={1.5} />
                </MagneticButton>
              </header>

              <main className="content-area">
              <div
                  className="canvas-wrapper"
                  onClick={activeTab === 'voice' ? toggleListening : undefined}
                  style={{ pointerEvents: activeTab === 'friends' ? 'none' : 'auto' }}
                >
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
                    <motion.div key="forum-view" className="forum-placeholder" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4, ease: "easeInOut" }}>
                      <MessageSquare size={48} color="var(--text-secondary)" strokeWidth={1} />
                      <h2>Community Forum</h2>
                      <p>Discussions will appear here.</p>
                    </motion.div>
                  )}

                  {appState === 'main' && activeTab === 'voice' && (
                    <div className="interaction-overlay" key="interaction-overlay">
                      <AnimatePresence mode="wait">

                        {spokenText ? (
                          <motion.div
                            key="spoken-text"
                            initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                            transition={{ duration: 0.4 }}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}
                          >
                            <p className="transcript-text" style={{ textAlign: 'center' }}>
                              {spokenText.split(' ').map((word, i) => (
                                <motion.span
                                  key={`${spokenText}-${i}`}
                                  initial={{ opacity: 0, y: 6, filter: 'blur(3px)' }}
                                  animate={revealedWords > i
                                    ? { opacity: 1, y: 0, filter: 'blur(0px)' }
                                    : { opacity: 0, y: 6, filter: 'blur(3px)' }}
                                  transition={{ duration: 0.25, ease: 'easeOut' }}
                                  style={{ display: 'inline-block', marginRight: '0.28em' }}
                                >
                                  {word}
                                </motion.span>
                              ))}
                            </p>

                            {listeningForResponse && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 8,
                                  color: 'var(--text-secondary)', fontSize: 13, pointerEvents: 'none'
                                }}
                              >
                                <motion.div
                                  animate={{ scale: [1, 1.3, 1] }}
                                  transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                                  style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-primary)' }}
                                />
                                Listening...
                              </motion.div>
                            )}
                          </motion.div>

                        ) : recordingPhase && recordingPhase !== 'done' ? (
                          <motion.div
                            key="recording-phase"
                            initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                            transition={{ duration: 0.4 }}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, pointerEvents: 'auto' }}
                          >
                            {/* Pulsing dot */}
                            <motion.div
                              animate={recordingPhase === 'recording' ? { scale: [1, 1.4, 1], opacity: [1, 0.6, 1] } : { scale: 1 }}
                              transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                              style={{
                                width: 12, height: 12, borderRadius: '50%',
                                background: recordingPhase === 'recording' ? 'var(--text-primary)' : 'var(--text-secondary)',
                                boxShadow: recordingPhase === 'recording' ? '0 0 0 4px rgba(10,10,10,0.1)' : 'none',
                              }}
                            />

                            {/* Timer or status */}
                            <AnimatePresence mode="wait">
                              <motion.p
                                key={recordingPhase}
                                className="transcript-text"
                                style={{ textAlign: 'center', margin: 0 }}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.25 }}
                              >
                                {recordingPhase === 'recording' && (
                                  <span style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>
                                    {`${String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:${String(recordingSeconds % 60).padStart(2, '0')}`}
                                  </span>
                                )}
                                {recordingPhase === 'uploading' && "Saving your note…"}
                                {recordingPhase === 'processing' && "Processing…"}
                              </motion.p>
                            </AnimatePresence>

                            {/* Done + Cancel side by side — only while actively recording */}
                            <AnimatePresence>
                              {recordingPhase === 'recording' && (
                                <motion.div
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 8 }}
                                  transition={{ duration: 0.25, delay: 0.1 }}
                                  style={{ display: 'flex', flexDirection: 'row', gap: 10, alignItems: 'center' }}
                                >
                                  <motion.button
                                    whileHover={{ scale: 1.06, y: -1 }}
                                    whileTap={{ scale: 0.94 }}
                                    onClick={stopDailyRecording}
                                    style={{
                                      padding: '12px 24px',
                                      borderRadius: '24px',
                                      background: 'var(--text-primary)',
                                      color: 'var(--bg-colour)',
                                      border: '1px solid var(--text-primary)',
                                      fontSize: '14px',
                                      fontWeight: 600,
                                      fontFamily: 'inherit',
                                      cursor: 'pointer',
                                      boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                    }}
                                  >
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                                      <rect x="0" y="0" width="10" height="10" rx="2"/>
                                    </svg>
                                    Done
                                  </motion.button>

                                  <motion.button
                                    whileHover={{ scale: 1.06, y: -1 }}
                                    whileTap={{ scale: 0.94 }}
                                    onClick={() => {
                                      clearInterval(recordingTimerRef.current);
                                      if (mediaRecorderRef2.current?.state !== 'inactive') {
                                        mediaRecorderRef2.current?.stop();
                                      }
                                      setRecordingPhase(null);
                                    }}
                                    style={{
                                      padding: '12px 24px',
                                      borderRadius: '24px',
                                      background: 'transparent',
                                      color: 'var(--text-primary)',
                                      border: '1px solid rgba(0,0,0,0.15)',
                                      fontSize: '14px',
                                      fontWeight: 600,
                                      fontFamily: 'inherit',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Cancel
                                  </motion.button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>

                        ) : listeningForResponse ? (
                          <motion.div
                            key="listening-only"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              color: 'var(--text-secondary)', fontSize: 13, pointerEvents: 'none'
                            }}
                          >
                            <motion.div
                              animate={{ scale: [1, 1.3, 1] }}
                              transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                              style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-primary)' }}
                            />
                            Listening...
                          </motion.div>

                        ) : (
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
                        )}

                      </AnimatePresence>

                      <AnimatePresence>
                        {transcript && !spokenText && !listeningForResponse && (
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
                  currentUser={currentUser}
                  onFriendAdded={handleRefreshFriends}
                />


                {showRecordPrompt && (
                  <RecordDailySummaryPrompt
                    onYes={() => { setShowRecordPrompt(false); setShowRecordingSession(true); }}
                    onNo={() => setShowRecordPrompt(false)}
                  />
                )}

                {showRecordingSession && (
                  <RecordingSession
                    currentUser={currentUser}
                    audioRef={audioRef}
                    onDone={() => setShowRecordingSession(false)}
                  />
                )}
              </main>

              <AnimatePresence>
                {appState === 'main' && (
                  <motion.div className="bottom-nav-wrapper" initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 250, damping: 22 }}>
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
                      <MagneticButton isActive={activeTab === 'profile'} className="nav-item" ariaLabel="Profile" hoverScale={1.15} onClick={() => { setActiveTab('profile'); if (isListening) toggleListening(); }}>
                        <User size={22} strokeWidth={2} />
                        {activeTab === 'profile' && <motion.div layoutId="activeTabIndicator" className="active-indicator" initial={false} transition={{ type: "spring", stiffness: 400, damping: 25 }} />}
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