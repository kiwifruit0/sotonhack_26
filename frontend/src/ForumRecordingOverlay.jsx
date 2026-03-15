import React, { useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
      const val = data[i * step] / 255;
      const h = 4 + val * (H * 0.82 - 4);
      const x = i * (barW + gap);
      const y = (H - h) / 2;
      ctx.fillStyle = `rgba(10,10,10,${0.25 + val * 0.75})`;
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
      if (analyserNode && isActive) drawLive(ctx, W, H, analyserNode);
      else drawIdle(ctx, W, H);
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

const fmt = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export const ForumRecordingOverlay = ({
  mode,
  phase,
  seconds,
  username,
  onDone,
  onCancel,
  analyserNode,
  question,        // { id, text, author } — only for answer-question mode
  spokenText,      // the full text currently being spoken via TTS
  revealedWords,   // how many words have been revealed so far
}) => {
  const isAsking = mode === 'ask-question';
  const isRecording = phase === 'recording';
  const isReading = phase === 'reading'; // TTS playing the question

  const label = isAsking ? 'Ask a Question' : 'Answer a Question';

  const statusText = {
    reading: null,
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
          position: 'absolute', inset: 0, zIndex: 30,
          background: 'rgba(250,250,250,0.97)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '0 32px',
        }}
      >
        {/* Decorative rings */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute', width: 420, height: 420,
            borderRadius: '50%', border: '1px solid rgba(0,0,0,0.05)',
            pointerEvents: 'none',
          }}
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute', width: 280, height: 280,
            borderRadius: '50%', border: '1px solid rgba(0,0,0,0.04)',
            pointerEvents: 'none',
          }}
        />

        <motion.div
          initial={{ y: 40, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.05 }}
          style={{
            position: 'relative', zIndex: 2,
            background: 'rgba(255,255,255,0.92)',
            border: '1px solid rgba(0,0,0,0.07)',
            borderRadius: 28,
            padding: '32px 28px 28px',
            width: '100%', maxWidth: 400,
            boxShadow: '0 24px 64px rgba(0,0,0,0.09), 0 2px 4px rgba(0,0,0,0.04)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}
        >
          {/* Mode badge */}
          <p style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: '#878787', margin: '0 0 20px 0',
          }}>
            {label}
          </p>

          {/* ── READING PHASE: show question being spoken ── */}
          <AnimatePresence mode="wait">
            {isReading && question ? (
              <motion.div
                key="reading-phase"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                style={{
                  width: '100%',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
                }}
              >
                {/* Question card */}
                <div style={{
                  width: '100%',
                  background: '#0a0a0a',
                  borderRadius: 18,
                  padding: '20px 20px 16px',
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', top: -30, right: -30,
                    width: 120, height: 120, borderRadius: '50%',
                    border: '1px solid rgba(255,255,255,0.07)',
                    pointerEvents: 'none',
                  }} />
                  <p style={{
                    fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.4)', margin: '0 0 10px 0',
                  }}>
                    {question.author}
                  </p>

                  {/* Word-by-word reveal */}
                  <p style={{
                    fontSize: 16, fontWeight: 600, color: '#fafafa',
                    margin: 0, lineHeight: 1.5, letterSpacing: '-0.01em',
                  }}>
                    {(spokenText || question.text).split(' ').map((word, i) => (
                      <motion.span
                        key={i}
                        animate={{ opacity: revealedWords > i ? 1 : 0.2 }}
                        transition={{ duration: 0.2 }}
                        style={{ display: 'inline-block', marginRight: '0.28em' }}
                      >
                        {word}
                      </motion.span>
                    ))}
                  </p>
                </div>

                {/* Listening indicator */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  color: '#878787', fontSize: 12,
                }}>
                  <motion.div
                    animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
                    style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: '#0a0a0a',
                    }}
                  />
                  Reading question aloud…
                </div>

                {/* Cancel while reading */}
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={onCancel}
                  style={{
                    padding: '11px 24px', borderRadius: 24,
                    background: 'transparent', color: '#878787',
                    border: '1px solid rgba(0,0,0,0.1)',
                    fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
                    cursor: 'pointer', marginTop: 4,
                  }}
                >
                  Cancel
                </motion.button>
              </motion.div>

            ) : (
              // ── RECORDING / PROCESSING / UPLOADING PHASE ──
              <motion.div
                key="recording-phase"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                style={{
                  width: '100%',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
                }}
              >
                {/* If answering, show the question above the waveform as context */}
                {!isAsking && question && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      width: '100%',
                      background: 'rgba(0,0,0,0.04)',
                      borderRadius: 14,
                      padding: '12px 16px',
                      marginBottom: 20,
                      borderLeft: '3px solid rgba(0,0,0,0.15)',
                    }}
                  >
                    <p style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                      textTransform: 'uppercase', color: '#878787', margin: '0 0 6px 0',
                    }}>
                      {question.author}
                    </p>
                    <p style={{
                      fontSize: 13, color: '#0a0a0a', margin: 0,
                      lineHeight: 1.45, fontWeight: 500,
                    }}>
                      {question.text}
                    </p>
                  </motion.div>
                )}

                {/* Avatar + username */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                  style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: '#0a0a0a',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fafafa', fontSize: 16, fontWeight: 800,
                    letterSpacing: '0.04em', marginBottom: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                    position: 'relative',
                  }}
                >
                  {username?.slice(0, 2).toUpperCase() ?? '??'}
                  {isRecording && (
                    <motion.div
                      animate={{ scale: [1, 1.55, 1], opacity: [0.35, 0, 0.35] }}
                      transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                      style={{
                        position: 'absolute', inset: -6, borderRadius: '50%',
                        border: '2px solid rgba(10,10,10,0.3)',
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                </motion.div>

                <p style={{
                  fontSize: 15, fontWeight: 700, color: '#0a0a0a',
                  margin: '0 0 18px 0', letterSpacing: '-0.02em',
                }}>
                  {username}
                </p>

                {/* Waveform */}
                <div style={{
                  width: '100%', marginBottom: 16,
                  borderRadius: 12, padding: '14px 16px',
                  background: 'rgba(0,0,0,0.03)',
                  border: '1px solid rgba(0,0,0,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  minHeight: 80,
                }}>
                  <SoundWave analyserNode={analyserNode} isActive={isRecording} />
                </div>

                {/* Timer or status */}
                <AnimatePresence mode="wait">
                  {isRecording ? (
                    <motion.div
                      key="timer"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      style={{
                        display: 'flex', alignItems: 'center',
                        gap: 8, marginBottom: 20,
                      }}
                    >
                      <motion.div
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
                        style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: '#0a0a0a',
                        }}
                      />
                      <span style={{
                        fontVariantNumeric: 'tabular-nums', fontSize: 22,
                        fontWeight: 700, color: '#0a0a0a', letterSpacing: '0.04em',
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
                      style={{
                        fontSize: 13, color: '#878787', marginBottom: 20,
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}
                    >
                      {phase !== 'done' && (
                        <span style={{
                          width: 14, height: 14, borderRadius: '50%',
                          border: '2px solid rgba(0,0,0,0.1)',
                          borderTopColor: '#878787', display: 'inline-block',
                          animation: 'spin 0.7s linear infinite',
                        }} />
                      )}
                      {statusText}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Done + Cancel buttons */}
                <AnimatePresence>
                  {isRecording && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      style={{
                        display: 'flex', flexDirection: 'row',
                        gap: 10, width: '100%',
                      }}
                    >
                      <motion.button
                        whileHover={{ scale: 1.03, y: -1 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={onDone}
                        style={{
                          flex: 1, padding: '14px', borderRadius: 16,
                          background: '#0a0a0a', color: '#fafafa',
                          border: 'none', fontSize: 15, fontWeight: 700,
                          fontFamily: 'inherit', cursor: 'pointer',
                          boxShadow: '0 6px 20px rgba(0,0,0,0.16)',
                          display: 'flex', alignItems: 'center',
                          justifyContent: 'center', gap: 8,
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
                          padding: '14px 20px', borderRadius: 16,
                          background: 'transparent', color: '#878787',
                          border: '1px solid rgba(0,0,0,0.1)',
                          fontSize: 15, fontWeight: 600,
                          fontFamily: 'inherit', cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};