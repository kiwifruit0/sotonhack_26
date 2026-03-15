// ── ForumRecordingOverlay ────────────────────────────────────────────────────
// Drop this component into App.jsx and render it inside <main className="content-area">
// It replaces the invisible recording UX with a full-screen forum-tab overlay.
//
// Props:
//   mode         – 'ask-question' | 'answer-question'
//   phase        – 'recording' | 'processing' | 'uploading' | 'done'
//   seconds      – elapsed recording seconds (integer)
//   username     – display name of the current user
//   onDone       – called when the user taps the "Done" button
//   onCancel     – called when the user taps "Cancel"
//   analyserNode – optional Web Audio AnalyserNode for live waveform

import React, { useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Animated waveform canvas ── */
const SoundWave = ({ analyserNode, isActive }) => {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  const drawIdle = useCallback((ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    const bars = 48;
    const gap = 4;
    const barW = (W - gap * (bars - 1)) / bars;
    const now = Date.now() / 1000;
    ctx.fillStyle = 'rgba(10,10,10,0.18)';
    for (let i = 0; i < bars; i++) {
      const h = 6 + Math.sin(now * 1.4 + i * 0.35) * 5 + Math.sin(now * 0.7 + i * 0.6) * 3;
      const x = i * (barW + gap);
      const y = (H - h) / 2;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, h, barW / 2);
      ctx.fill();
    }
  }, []);

  const drawLive = useCallback((ctx, W, H, analyser) => {
    const bufLen = analyser.frequencyBinCount;
    const data = new Uint8Array(bufLen);
    analyser.getByteFrequencyData(data);

    ctx.clearRect(0, 0, W, H);
    const bars = 48;
    const gap = 4;
    const barW = (W - gap * (bars - 1)) / bars;
    const step = Math.floor(bufLen / bars);

    for (let i = 0; i < bars; i++) {
      const val = data[i * step] / 255; // 0–1
      const minH = 4;
      const maxH = H * 0.82;
      const h = minH + val * (maxH - minH);
      const x = i * (barW + gap);
      const y = (H - h) / 2;
      const alpha = 0.25 + val * 0.75;
      ctx.fillStyle = `rgba(10,10,10,${alpha})`;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, h, barW / 2);
      ctx.fill();
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const loop = () => {
      const W = canvas.width;
      const H = canvas.height;
      if (analyserNode && isActive) {
        drawLive(ctx, W, H, analyserNode);
      } else {
        drawIdle(ctx, W, H);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyserNode, isActive, drawIdle, drawLive]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={80}
      style={{ width: '100%', maxWidth: 320, height: 80, display: 'block' }}
    />
  );
};

/* ── Timer formatter ── */
const fmt = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/* ── Main overlay ── */
export const ForumRecordingOverlay = ({
  mode,
  phase,
  seconds,
  username,
  onDone,
  onCancel,
  analyserNode,
}) => {
  const isAsking = mode === 'ask-question';
  const isRecording = phase === 'recording';

  const label = isAsking ? 'Ask a Question' : 'Answer a Question';
  const subLabel = isAsking
    ? 'Speak your question — the community will hear it.'
    : 'Record your answer — your voice will be posted.';

  const statusText = {
    recording: null,
    processing: isAsking ? 'Transcribing your question…' : 'Transcribing your answer…',
    uploading: isAsking ? 'Posting your question…' : 'Posting your answer…',
    done: isAsking ? 'Question posted!' : 'Answer posted!',
  }[phase];

  return (
    <AnimatePresence>
      <motion.div
        key="forum-recording-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 30,
          background: 'rgba(250,250,250,0.96)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0,
          padding: '0 32px',
        }}
      >
        {/* Decorative ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute',
            width: 420,
            height: 420,
            borderRadius: '50%',
            border: '1px solid rgba(0,0,0,0.05)',
            pointerEvents: 'none',
          }}
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute',
            width: 280,
            height: 280,
            borderRadius: '50%',
            border: '1px solid rgba(0,0,0,0.04)',
            pointerEvents: 'none',
          }}
        />

        {/* Inner card */}
        <motion.div
          initial={{ y: 40, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.05 }}
          style={{
            position: 'relative',
            zIndex: 2,
            background: 'rgba(255,255,255,0.92)',
            border: '1px solid rgba(0,0,0,0.07)',
            borderRadius: 28,
            padding: '36px 32px 32px',
            width: '100%',
            maxWidth: 380,
            boxShadow: '0 24px 64px rgba(0,0,0,0.09), 0 2px 4px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0,
          }}
        >
          {/* Mode badge */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#878787',
              marginBottom: 18,
            }}
          >
            {label}
          </motion.div>

          {/* Avatar + username */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22, delay: 0.2 }}
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#0a0a0a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fafafa',
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: '0.04em',
              marginBottom: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              position: 'relative',
            }}
          >
            {username?.slice(0, 2).toUpperCase() ?? '??'}

            {/* Pulsing ring when recording */}
            {isRecording && (
              <motion.div
                animate={{ scale: [1, 1.55, 1], opacity: [0.35, 0, 0.35] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                style={{
                  position: 'absolute',
                  inset: -6,
                  borderRadius: '50%',
                  border: '2px solid rgba(10,10,10,0.3)',
                  pointerEvents: 'none',
                }}
              />
            )}
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: '#0a0a0a',
              margin: '0 0 4px 0',
              letterSpacing: '-0.02em',
            }}
          >
            {username}
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{
              fontSize: 13,
              color: '#878787',
              margin: '0 0 28px 0',
              textAlign: 'center',
              lineHeight: 1.5,
              maxWidth: 240,
            }}
          >
            {subLabel}
          </motion.p>

          {/* Waveform */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0.85 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: 0.32, duration: 0.4 }}
            style={{
              width: '100%',
              marginBottom: 20,
              borderRadius: 12,
              padding: '14px 16px',
              background: 'rgba(0,0,0,0.03)',
              border: '1px solid rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 80,
            }}
          >
            <SoundWave analyserNode={analyserNode} isActive={isRecording} />
          </motion.div>

          {/* Timer or status */}
          <AnimatePresence mode="wait">
            {isRecording ? (
              <motion.div
                key="timer"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 24,
                }}
              >
                <motion.div
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#0a0a0a',
                  }}
                />
                <span style={{
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: 22,
                  fontWeight: 700,
                  color: '#0a0a0a',
                  letterSpacing: '0.04em',
                }}>
                  {fmt(seconds)}
                </span>
              </motion.div>
            ) : (
              <motion.div
                key="status"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                style={{
                  fontSize: 13,
                  color: '#878787',
                  marginBottom: 24,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {phase !== 'done' && (
                  <span style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    border: '2px solid rgba(0,0,0,0.1)',
                    borderTopColor: '#878787',
                    display: 'inline-block',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                )}
                {statusText}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action buttons */}
          <AnimatePresence>
            {isRecording && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ delay: 0.1 }}
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  gap: 10,
                  width: '100%',
                }}
              >
                <motion.button
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={onDone}
                  style={{
                    flex: 1,
                    padding: '14px',
                    borderRadius: 16,
                    background: '#0a0a0a',
                    color: '#fafafa',
                    border: 'none',
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    boxShadow: '0 6px 20px rgba(0,0,0,0.16)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    letterSpacing: '0.01em',
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                    <rect x="0" y="0" width="10" height="10" rx="2.5" />
                  </svg>
                  Done
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={onCancel}
                  style={{
                    padding: '14px 20px',
                    borderRadius: 16,
                    background: 'transparent',
                    color: '#878787',
                    border: '1px solid rgba(0,0,0,0.1)',
                    fontSize: 15,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Cancel
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};