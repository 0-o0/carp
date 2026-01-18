'use client';

import { useEffect, useState } from 'react';

export function Confetti() {
  const [confetti, setConfetti] = useState<Array<{ id: number; left: number; color: string; delay: number }>>([]);

  useEffect(() => {
    const colors = ['#f97316', '#22c55e', '#3b82f6', '#eab308', '#ec4899', '#8b5cf6'];
    const pieces = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 2,
    }));
    setConfetti(pieces);

    const timer = setTimeout(() => {
      setConfetti([]);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {confetti.map(piece => (
        <div
          key={piece.id}
          className="confetti"
          style={{
            left: `${piece.left}%`,
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
          }}
        />
      ))}
    </>
  );
}
