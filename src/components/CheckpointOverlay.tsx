import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Clock, Zap, User } from 'lucide-react';
import type { CheckpointStanding } from '../game/types';
import { useState } from 'react';
import { riderById } from '../game/loadouts';
import { capsuleById } from '../game/loadouts';

interface CheckpointOverlayProps {
  standings: CheckpointStanding[];
  countdownNumber?: number;
  onReadyUp: () => void;
  status: 'checkpoint' | 'countdown';
}

export default function CheckpointOverlay({ standings, countdownNumber, onReadyUp, status }: CheckpointOverlayProps) {
  const [selectedRacer, setSelectedRacer] = useState<CheckpointStanding | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
    >
      {/* Countdown overlay */}
      <AnimatePresence>
        {status === 'countdown' && countdownNumber !== undefined && (
          <motion.div
            key={`countdown-${countdownNumber}`}
            initial={{ scale: 2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex items-center justify-center z-60 pointer-events-none"
          >
            <span className="text-[12rem] font-black text-amber-400 drop-shadow-[0_0_40px_rgba(255,170,0,0.8)]">
              {countdownNumber > 0 ? countdownNumber : 'GO!'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Checkpoint standings panel */}
      {status === 'checkpoint' && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="relative w-full max-w-2xl mx-4 bg-zinc-950/95 border border-amber-500/60 rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-950/80 to-zinc-900/80 border-b border-amber-500/40 px-6 py-4">
            <div className="flex items-center gap-3">
              <Trophy className="text-amber-400" size={24} />
              <div>
                <h2 className="text-lg font-black text-amber-300 tracking-wider uppercase">
                  Granite Tunnel Portal
                </h2>
                <p className="text-xs text-zinc-400">Checkpoint — Pole Positions</p>
              </div>
            </div>
          </div>

          {/* Standings list */}
          <div className="p-4 space-y-2 max-h-[50vh] overflow-y-auto">
            {standings.map((racer) => (
              <motion.div
                key={racer.id}
                whileHover={{ scale: 1.02 }}
                onClick={() => setSelectedRacer(selectedRacer?.id === racer.id ? null : racer)}
                className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedRacer?.id === racer.id
                    ? 'bg-amber-950/60 border-amber-500/80'
                    : racer.isPlayer
                    ? 'bg-amber-950/30 border-amber-600/40 hover:border-amber-500/60'
                    : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {/* Position badge */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg ${
                    racer.position === 1
                      ? 'bg-amber-500 text-zinc-950'
                      : racer.position === 2
                      ? 'bg-zinc-400 text-zinc-950'
                      : racer.position === 3
                      ? 'bg-amber-800 text-amber-200'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {racer.position}
                </div>

                {/* Ball color indicator */}
                <div
                  className="w-8 h-8 rounded-full border-2 border-white/20 shadow-lg"
                  style={{ backgroundColor: racer.color }}
                />

                {/* Racer info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-amber-200 truncate">
                      {racer.name}
                    </span>
                    {racer.isPlayer && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded font-bold border border-amber-500/40">
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-zinc-400 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {racer.raceTime.toFixed(1)}s
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap size={10} />
                      {racer.speed} km/h
                    </span>
                  </div>
                </div>

                {/* Distance */}
                <div className="text-right">
                  <span className="text-sm font-mono text-amber-300">{racer.distance}m</span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Selected racer detail */}
          <AnimatePresence>
            {selectedRacer && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-zinc-800 overflow-hidden"
              >
                <div className="p-4 bg-zinc-900/80">
                  <div className="flex items-center gap-4">
                    <User className="text-amber-400" size={20} />
                    <div>
                      <h3 className="font-bold text-amber-200">{selectedRacer.name}</h3>
                      <p className="text-xs text-zinc-400 mt-1">
                        {selectedRacer.loadout
                          ? `${riderById(selectedRacer.loadout.rider).name} • ${capsuleById(selectedRacer.loadout.capsule).name}`
                          : 'Loadout details unavailable'}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Ready Up button */}
          <div className="border-t border-amber-500/30 bg-zinc-900/90 px-6 py-4">
            <button
              onClick={onReadyUp}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black text-lg rounded-lg shadow-lg shadow-amber-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              READY UP
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
