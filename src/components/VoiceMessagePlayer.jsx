import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, AlertCircle } from 'lucide-react';

/**
 * Interactive Audio Message Player for CollabS Team Chat
 * Features play/pause, scrubbable progress bar, elapsed time, and dynamic waveform animation.
 */
export default function VoiceMessagePlayer({ audioUrl, duration = 0, isMe = false }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(Number(duration) || 0);
  const [loadError, setLoadError] = useState(false);
  const audioRef = useRef(null);

  // Format seconds to mm:ss
  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Toggle playback
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => {
        console.warn('Playback error', err);
        setLoadError(true);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !totalDuration) {
        setTotalDuration(audioRef.current.duration);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration)) {
      setTotalDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  // Simulated bar heights for voice waveform
  const waveformHeights = [25, 45, 75, 35, 90, 60, 40, 80, 50, 95, 65, 30, 70, 45, 85, 40];

  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className={`collabs-voice-player ${isMe ? 'own-voice' : ''}`}>
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={() => setLoadError(true)}
      />

      <button
        type="button"
        className={`voice-play-btn ${isPlaying ? 'playing' : ''}`}
        onClick={togglePlay}
        title={isPlaying ? 'Pause' : 'Play voice note'}
        aria-label={isPlaying ? 'Pause' : 'Play voice note'}
      >
        {isPlaying ? <Pause size={15} /> : <Play size={15} className="play-icon-offset" />}
      </button>

      <div className="voice-player-main">
        {/* Dynamic Waveform Visualizer */}
        <div className="voice-waveform-container" onClick={togglePlay}>
          {waveformHeights.map((h, i) => {
            const barPercent = (i / waveformHeights.length) * 100;
            const isPassed = barPercent <= progressPercent;
            return (
              <span
                key={i}
                className={`wave-bar ${isPassed ? 'active' : ''} ${isPlaying ? 'animating' : ''}`}
                style={{
                  height: `${h}%`,
                  animationDelay: `${(i % 5) * 0.12}s`
                }}
              />
            );
          })}
        </div>

        {/* Hidden / Native scrubber control */}
        <input
          type="range"
          min="0"
          max={totalDuration || 1}
          step="0.1"
          value={currentTime}
          onChange={handleSeek}
          className="voice-scrubber-slider"
          aria-label="Seek audio"
        />

        {/* Time and Status Footer */}
        <div className="voice-player-meta">
          <span className="voice-duration">
            {isPlaying ? formatTime(currentTime) : formatTime(totalDuration)}
          </span>
          <span className="voice-pill-tag">
            <Volume2 size={11} /> Voice Memo
          </span>
        </div>
      </div>

      {loadError && (
        <span className="voice-error-badge" title="Failed to load audio">
          <AlertCircle size={12} />
        </span>
      )}
    </div>
  );
}
